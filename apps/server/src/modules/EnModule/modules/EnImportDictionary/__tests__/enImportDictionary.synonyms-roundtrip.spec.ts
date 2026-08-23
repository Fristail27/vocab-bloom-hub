import '../../../__tests__/helpers/clearDatabaseUrl';

import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import { readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { type Response } from 'express';

// The export unlinks its jsonl files right after zipping; keep them so the
// import half of the round trip can read them back
jest.mock('node:fs/promises', () => {
  const actual = jest.requireActual<typeof import('node:fs/promises')>('node:fs/promises');
  return { ...actual, unlink: jest.fn(async () => undefined) };
});

import { EnEntry } from '../../../entities/en_entry.entity';
import { EnWord } from '../../../entities/en_word.entity';
import { EnMeaning } from '../../../entities/en_meaning.entity';
import { EnMeaningTranslation } from '../../../entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../../../entities/en_short_translation.entity';
import { EnService } from '../../../en.service';
import { EnShortTranslationService } from '../../EnShortTranslation/enShortTranslation.service';
import { EnMeaningService } from '../../EnMeaning/enMeaning.service';
import { EnMeaningTranslationService } from '../../EnMeaningTranslation/enMeaningTranslation.service';
import { EnImportDictionaryService } from '../enImportDictionary.service';
import { SettingsService } from '../../../../SettingsModule/settings.service';
import { DATASET_FILE_NAMES, MANIFEST_FILE_NAME } from '../constants';
import { EnMeaningT, EnPartOfSpeechE, EnWordFormsE, EnWordT } from '../../../../../../types';

class FakeProgressRes {
  chunks: string[] = [];
  setHeader = jest.fn();
  write = (chunk: string) => {
    this.chunks.push(chunk);
    return true;
  };
  end = jest.fn();
}

const makeDataSource = () =>
  new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: [EnEntry, EnWord, EnMeaning, EnMeaningTranslation, EnShortTranslation],
    synchronize: true,
    prepareDatabase: (db) => {
      db.pragma('foreign_keys = ON');
    },
  });

const makeServices = (ds: DataSource) => {
  const shortTranslationService = new EnShortTranslationService(
    ds.getRepository(EnWord),
    ds.getRepository(EnShortTranslation),
  );
  const meaningTranslationService = new EnMeaningTranslationService(
    ds.getRepository(EnMeaning),
    ds.getRepository(EnMeaningTranslation),
  );
  const meaningService = new EnMeaningService(
    ds.getRepository(EnWord),
    ds.getRepository(EnMeaning),
    meaningTranslationService,
  );
  const enService = new EnService(ds.getRepository(EnWord), ds, shortTranslationService, meaningService);
  const settingsService = { upsert: jest.fn(async () => ({ success: true })) } as unknown as SettingsService;
  const importService = new EnImportDictionaryService(ds.getRepository(EnWord), settingsService);
  return { enService, importService };
};

const makeWord = (word: string, part_of_speech: EnPartOfSpeechE, meanings: Partial<EnMeaningT>[]): EnWordT =>
  ({
    word,
    part_of_speech,
    form_of_word: EnWordFormsE.base_form,
    forms: [],
    short_translations: [],
    meanings: meanings.map((m, i) => ({
      title: `${word} ${i + 1}`,
      definition: `definition of ${word} ${i + 1}`,
      sort_order: i + 1,
      examples: [],
      synonyms: [],
      translations: [],
      ...m,
    })),
  }) as unknown as EnWordT;

/** meaning title -> sorted synonym headwords, across the whole database */
const synonymsByTitle = async (ds: DataSource): Promise<Record<string, string[]>> => {
  const meanings = await ds.getRepository(EnMeaning).find({ relations: { synonyms: true } });
  return Object.fromEntries(meanings.map((m) => [m.title, m.synonyms.map((e) => e.word).sort()]));
};

describe('synonyms survive an export → import round trip (issue #259)', () => {
  let sourceDs: DataSource;
  let targetDs: DataSource;
  let runDir: string;
  let zipPath: string;

  beforeAll(async () => {
    sourceDs = makeDataSource();
    await sourceDs.initialize();
    const { enService, importService } = makeServices(sourceDs);

    // words, a phrasal verb and a phrase that reference each other across the
    // dataset files; "ran" is a form entry and must not become a target
    await enService.addWord(makeWord('sprint', EnPartOfSpeechE.verb, [{}]));
    await enService.addWord(makeWord('dash', EnPartOfSpeechE.noun, [{}]));
    await enService.addWord(makeWord('give', EnPartOfSpeechE.verb, [{}]));
    await enService.addWord(makeWord('give up', EnPartOfSpeechE.verb, [{ synonyms: ['sprint'] }]));
    const run = makeWord('run', EnPartOfSpeechE.verb, [
      { synonyms: ['sprint', 'dash'] },
      { synonyms: ['give up'] },
    ]);
    run.forms = [{ word: 'ran', form_of_word: EnWordFormsE.past_simple }] as unknown as EnWordT['forms'];
    await enService.addWord(run);
    await enService.addWord(
      makeWord('in the long run', EnPartOfSpeechE.phrase, [{ synonyms: ['run', 'give up'] }]),
    );
    // the phrase did not exist yet when "run" was added: link it afterwards, so
    // the words file references a word that only the phrases file provides
    const runMeaning = await sourceDs
      .getRepository(EnMeaning)
      .findOneOrFail({ where: { title: 'run 1' }, relations: { synonyms: true } });
    const longRun = await sourceDs.getRepository(EnEntry).findOneByOrFail({ word: 'in the long run' });
    runMeaning.synonyms.push(longRun);
    await sourceDs.getRepository(EnMeaning).save(runMeaning);

    const progress = new FakeProgressRes();
    await importService.exportDictionary(progress as unknown as Response);
    const exportId = (JSON.parse(progress.chunks[progress.chunks.length - 1]) as { exportId: string }).exportId;
    runDir = path.join(os.tmpdir(), 'vocab-bloom-export', exportId);
    zipPath = path.join(os.tmpdir(), 'vocab-bloom-export', `${exportId}.zip`);
    const pending = (importService as unknown as { pendingExports: Map<string, { timeout: NodeJS.Timeout }> })
      .pendingExports;
    for (const entry of pending.values()) clearTimeout(entry.timeout);

    // serve the exported files to the import of a fresh database
    const files: Record<string, string> = Object.fromEntries(
      [...Object.values(DATASET_FILE_NAMES), MANIFEST_FILE_NAME].map((name) => [
        name,
        readFileSync(path.join(runDir, name), 'utf-8'),
      ]),
    );
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const fileName = String(input).split('/').pop() as string;
      const body = files[fileName];
      return body === undefined
        ? new Response('not found', { status: 404 })
        : new Response(body, { status: 200, headers: { 'content-length': String(Buffer.byteLength(body)) } });
    });

    targetDs = makeDataSource();
    await targetDs.initialize();
    await makeServices(targetDs).importService.importDictionary(
      {},
      new FakeProgressRes() as unknown as Response,
    );
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await rm(runDir, { recursive: true, force: true });
    await rm(zipPath, { force: true });
    await sourceDs.destroy();
    await targetDs.destroy();
  });

  it('exports every synonym with its part of speech', () => {
    const words = readFileSync(path.join(runDir, DATASET_FILE_NAMES.words), 'utf-8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as { word: string; meanings: Array<{ title: string; synonyms: unknown[] }> });
    const run = words.find((w) => w.word === 'run');
    expect(run?.meanings.find((m) => m.title === 'run 1')?.synonyms).toEqual([
      { word: 'dash', part_of_speech: EnPartOfSpeechE.noun },
      { word: 'in the long run', part_of_speech: EnPartOfSpeechE.phrase },
      { word: 'sprint', part_of_speech: EnPartOfSpeechE.verb },
    ]);
  });

  it('records the link count in the manifest for the import progress total', () => {
    const manifest = JSON.parse(readFileSync(path.join(runDir, MANIFEST_FILE_NAME), 'utf-8')) as {
      synonym_links: number;
    };
    expect(manifest.synonym_links).toBe(7);
  });

  it('restores the same links in the imported database, across dataset files', async () => {
    const expected = await synonymsByTitle(sourceDs);
    expect(expected['run 1']).toEqual(['dash', 'in the long run', 'sprint']);
    expect(expected['in the long run 1']).toEqual(['give up', 'run']);

    expect(await synonymsByTitle(targetDs)).toEqual(expected);
    // every link resolved: nothing was silently dropped
    expect(await targetDs.getRepository(EnMeaning).count()).toBe(7);
    expect(
      (await targetDs.getRepository(EnMeaning).find({ relations: { synonyms: true } })).reduce(
        (n, m) => n + m.synonyms.length,
        0,
      ),
    ).toBe(7);
  });
});
