import '../../../__tests__/helpers/clearDatabaseUrl';

import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { existsSync, readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { Writable } from 'node:stream';
import * as path from 'node:path';
import * as os from 'node:os';
import { type Response } from 'express';

// The export flow unlinks the intermediate jsonl files right after zipping them.
// Keep them on disk so the test can validate the NDJSON content line by line.
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
import { EnDictionaryImportPhasesE } from '../constants';
import {
  AvailableTranslationLanguagesE,
  EnMeaningT,
  EnPartOfSpeechE,
  EnShortTranslationT,
  EnWordFormsE,
  EnWordT,
} from '../../../../../../types';

type ProgressChunk = {
  percent: number;
  stage: EnDictionaryImportPhasesE;
  exportId?: string;
};

class FakeProgressRes {
  chunks: string[] = [];
  ended = false;
  setHeader = jest.fn();
  write = (chunk: string) => {
    this.chunks.push(chunk);
    return true;
  };
  end = () => {
    this.ended = true;
  };
}

class FakeDownloadRes extends Writable {
  headers: Record<string, unknown> = {};
  buffers: Buffer[] = [];
  setHeader(key: string, value: unknown) {
    this.headers[key] = value;
  }
  override _write(chunk: Buffer, _encoding: string, callback: () => void) {
    this.buffers.push(Buffer.from(chunk));
    callback();
  }
}

describe('EnImportDictionaryService NDJSON export (issue #187)', () => {
  let ds: DataSource;
  let service: EnImportDictionaryService;
  let progressRes: FakeProgressRes;
  let exportId: string;
  let runDir: string;
  let zipPath: string;

  const makeWordBody = (word: string, extra: Partial<EnWordT> = {}): EnWordT =>
    ({
      word,
      part_of_speech: EnPartOfSpeechE.verb,
      form_of_word: EnWordFormsE.base_form,
      forms: [{ word: `${word}s`, form_of_word: EnWordFormsE.third_person_singular }] as EnWordT['forms'],
      meanings: [
        {
          title: 'to move fast',
          definition: 'to move fast on foot',
          sort_order: 1,
          examples: [],
          translations: [
            {
              title: 'бежать',
              definition: 'быстро перемещаться',
              language: AvailableTranslationLanguagesE.ru,
            },
          ],
        },
      ] as unknown as EnMeaningT[],
      short_translations: [
        {
          language: AvailableTranslationLanguagesE.ru,
          description: 'бежать',
          variants_of_words: ['бежать'],
        },
      ] as unknown as EnShortTranslationT[],
      ...extra,
    }) as EnWordT;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [EnEntry, EnWord, EnMeaning, EnMeaningTranslation, EnShortTranslation],
      synchronize: true,
    });
    await ds.initialize();

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

    const settingsService = { upsert: jest.fn() } as unknown as SettingsService;
    service = new EnImportDictionaryService(ds.getRepository(EnWord), settingsService);

    await enService.addWord(makeWordBody('run'));
    // a phrasal pair so the export produces a phrasal-verbs linking line
    await enService.addWord(makeWordBody('give', { forms: [] }));
    await enService.addWord(
      makeWordBody('give up', {
        forms: [],
        verb___is_phrasal: true,
        base_phrasal: 'give',
      } as unknown as Partial<EnWordT>),
    );
    await enService.addWord(
      makeWordBody('in the long run', {
        part_of_speech: EnPartOfSpeechE.phrase,
        forms: [],
        // synonyms are links to the entries added above (issue #259)
        meanings: [
          {
            title: 'eventually',
            definition: 'over a long period of time',
            sort_order: 1,
            examples: [],
            synonyms: ['run', 'Give up'],
            translations: [],
          },
        ] as unknown as EnMeaningT[],
      }),
    );
    await enService.addWord(
      makeWordBody('would rather + verb', {
        part_of_speech: EnPartOfSpeechE.grammar_pattern,
        pattern: ['would rather', 'verb'],
        forms: [],
      }),
    );

    progressRes = new FakeProgressRes();
    await service.exportDictionary(progressRes as unknown as Response);

    const finalChunk = JSON.parse(progressRes.chunks[progressRes.chunks.length - 1]) as ProgressChunk;
    exportId = finalChunk.exportId as string;
    runDir = path.join(os.tmpdir(), 'vocab-bloom-export', exportId);
    zipPath = path.join(os.tmpdir(), 'vocab-bloom-export', `${exportId}.zip`);
  });

  afterAll(async () => {
    // Cancel the pending TTL cleanup timer so Jest can exit, then wipe tmp files
    const pending = (service as unknown as { pendingExports: Map<string, { timeout: NodeJS.Timeout }> })
      .pendingExports;
    for (const entry of pending.values()) clearTimeout(entry.timeout);
    await rm(runDir, { recursive: true, force: true });
    await rm(zipPath, { force: true });
    await ds.destroy();
  });

  const readJsonlLines = (fileName: string): Record<string, unknown>[] =>
    readFileSync(path.join(runDir, fileName), 'utf-8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as Record<string, unknown>);

  it('streams progress as NDJSON and finishes with the export id', () => {
    expect(progressRes.ended).toBe(true);
    // every written chunk is exactly one JSON line
    for (const chunk of progressRes.chunks) {
      expect(chunk.endsWith('\n')).toBe(true);
      expect(() => JSON.parse(chunk)).not.toThrow();
    }

    const finalChunk = JSON.parse(progressRes.chunks[progressRes.chunks.length - 1]) as ProgressChunk;
    expect(finalChunk.percent).toBe(100);
    expect(finalChunk.stage).toBe(EnDictionaryImportPhasesE.completed);
    expect(typeof finalChunk.exportId).toBe('string');
  });

  it('writes words as one JSON object per line without system fields', () => {
    const lines = readJsonlLines('vocab-bloom-hub-en-words.jsonl');

    expect(lines).toHaveLength(3);
    const word = lines.find((l) => l.word === 'run') as Record<string, unknown>;
    expect(word.word).toBe('run');
    expect(word.part_of_speech).toBe(EnPartOfSpeechE.verb);
    expect(word.forms).toEqual([
      expect.objectContaining({ word: 'runs', form_of_word: EnWordFormsE.third_person_singular }),
    ]);
    expect(word.meanings).toEqual([
      expect.objectContaining({
        title: 'to move fast',
        synonyms: [],
        translations: [expect.objectContaining({ title: 'бежать' })],
      }),
    ]);
    expect(word.short_translations).toEqual([expect.objectContaining({ description: 'бежать' })]);

    // system fields are stripped everywhere by cleanEntity
    const raw = JSON.stringify(lines);
    expect(raw).not.toContain('"id"');
    expect(raw).not.toContain('"createdAt"');
    expect(raw).not.toContain('"updateAt"');
  });

  it('exports phrases and grammar patterns into their own NDJSON files', () => {
    const phrases = readJsonlLines('vocab-bloom-hub-en-phrases.jsonl');
    expect(phrases).toHaveLength(1);
    expect(phrases[0].phrase).toBe('in the long run');
    expect(phrases[0]).not.toHaveProperty('part_of_speech');
    // synonyms are exported as word + part of speech, sorted by word; "run" is
    // a verb here because the phrase has no verb sense and run's only base form is the verb
    expect(phrases[0].meanings).toEqual([
      expect.objectContaining({
        synonyms: [
          { word: 'give up', part_of_speech: EnPartOfSpeechE.verb },
          { word: 'run', part_of_speech: EnPartOfSpeechE.verb },
        ],
      }),
    ]);

    const grammar = readJsonlLines('vocab-bloom-hub-en-grammar-patterns.jsonl');
    expect(grammar).toHaveLength(1);
    expect(grammar[0].phrase).toBe('would rather + verb');
    expect(grammar[0].pattern).toEqual(['would rather', 'verb']);
  });

  it('exports the phrasal-verbs linking file and a manifest matching the jsonl line counts', () => {
    // one line per base verb that has phrasal variants; run and give up have none
    const phrasal = readJsonlLines('vocab-bloom-hub-en-phrasal-verbs.jsonl');
    expect(phrasal).toEqual([{ word: 'give', phrasal_variants: ['give up'] }]);

    const manifest = JSON.parse(readFileSync(path.join(runDir, 'manifest.json'), 'utf-8')) as {
      version: string;
      generatedAt: string;
      files: Record<string, { lines: number }>;
      synonym_links: number;
    };
    expect(typeof manifest.version).toBe('string');
    expect(manifest.version.length).toBeGreaterThan(0);
    // "in the long run" links to run and give up (issue #259)
    expect(manifest.synonym_links).toBe(2);
    expect(manifest.files).toEqual({
      'vocab-bloom-hub-en-words.jsonl': { lines: 3 },
      'vocab-bloom-hub-en-phrasal-verbs.jsonl': { lines: 1 },
      'vocab-bloom-hub-en-grammar-patterns.jsonl': { lines: 1 },
      'vocab-bloom-hub-en-phrases.jsonl': { lines: 1 },
    });
  });

  it('packs the archive and serves it once via streamExportFile', async () => {
    expect(existsSync(zipPath)).toBe(true);

    const downloadRes = new FakeDownloadRes();
    await service.streamExportFile(exportId, downloadRes as unknown as Response);

    const bytes = Buffer.concat(downloadRes.buffers);
    // zip local file header magic
    expect(bytes.subarray(0, 2).toString('ascii')).toBe('PK');
    expect(downloadRes.headers['Content-Type']).toBe('application/zip');
    expect(downloadRes.headers['Content-Length']).toBe(bytes.length);

    // the export is one-shot: a second download attempt is rejected
    await expect(
      service.streamExportFile(exportId, new FakeDownloadRes() as unknown as Response),
    ).rejects.toThrow(NotFoundException);
  });
});
