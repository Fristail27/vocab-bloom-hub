import '../../../__tests__/helpers/clearDatabaseUrl';

import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { type Response as ExpressResponse } from 'express';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as yazl from 'yazl';

import { EnEntry } from '../../../entities/en_entry.entity';
import { EnWord } from '../../../entities/en_word.entity';
import { EnMeaning } from '../../../entities/en_meaning.entity';
import { EnMeaningTranslation } from '../../../entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../../../entities/en_short_translation.entity';
import { EnImportDictionaryService } from '../enImportDictionary.service';
import { SettingsService } from '../../../../SettingsModule/settings.service';
import { DATASET_VERSION_SETTINGS_FIELD, EnDictionaryImportPhasesE } from '../constants';
import { ErrorCodes } from '../../../../../../core/constants/error_codes';
import {
  AvailableTranslationLanguagesE,
  EnEntryTypesE,
  EnPartOfSpeechE,
  ImportSourceKindE,
} from '../../../../../../types';

type ProgressChunk = {
  percent: number;
  stage: EnDictionaryImportPhasesE;
  downloaded?: number;
  total?: number;
  datasetVersion?: string;
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

// Minimal shape of a dataset word line consumed by mapWordFromSetToDB
const makeSetWord = (word: string, extra: Record<string, unknown> = {}) => ({
  word,
  part_of_speech: EnPartOfSpeechE.verb,
  area_variant: '',
  generated_by_model: '',
  generated: false,
  verb___phrasal_object_pattern: '',
  verb___transitivity: '',
  language_register: '',
  categories: [],
  verb___is_phrasal: false,
  verb___is_irregular: false,
  noun___is_proper: false,
  word_level: '',
  description: '',
  transcription: '',
  is_obsolete: false,
  version: '1.0.0',
  is_abbreviation: false,
  noun___uncountable: false,
  noun___irregular_plural: false,
  noun___always_plural: false,
  base_phrasal: '',
  phrasal_variants: [],
  forms: [],
  short_translations: [],
  meanings: [],
  ...extra,
});

const makeSetPhrase = (phrase: string, extra: Record<string, unknown> = {}) => ({
  phrase,
  area_variant: '',
  generated_by_model: '',
  generated: false,
  language_register: '',
  categories: [],
  level: '',
  description: '',
  transcription: '',
  is_obsolete: false,
  version: '1.0.0',
  short_translations: [],
  meanings: [],
  ...extra,
});

const toNdjson = (lines: unknown[]) => lines.map((l) => JSON.stringify(l)).join('\n') + '\n';

const mockDatasetFiles = (files: Record<string, string>) => {
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const fileName = url.split('/').pop() as string;
    const body = files[fileName];
    if (body === undefined) {
      return new Response('not found', { status: 404 });
    }
    return new Response(body, {
      status: 200,
      headers: { 'content-length': String(Buffer.byteLength(body)) },
    });
  });
};

const mockUpsert = jest.fn<(field: string, value: string) => Promise<{ success: boolean }>>(async () => ({
  success: true,
}));
const mockSettingsService = { upsert: mockUpsert } as unknown as SettingsService;

describe('EnImportDictionaryService NDJSON import (issue #87)', () => {
  let ds: DataSource;
  let service: EnImportDictionaryService;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [EnEntry, EnWord, EnMeaning, EnMeaningTranslation, EnShortTranslation],
      synchronize: true,
    });
    await ds.initialize();

    service = new EnImportDictionaryService(ds.getRepository(EnWord), mockSettingsService);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    mockUpsert.mockClear();
    (service as unknown as { manifestCache: unknown }).manifestCache = null;
    await ds.synchronize(true);
  });

  describe('full import flow', () => {
    const makeManifest = () =>
      JSON.stringify({
        version: '0.2.0',
        generatedAt: '2026-08-16T00:00:00Z',
        // 3 for "to hand over" + 1 for "eventually" (issue #259)
        synonym_links: 4,
        // 2 for "to hand over" (issue #266)
        antonym_links: 2,
        files: {
          'vocab-bloom-hub-en-words.jsonl': { lines: 3 },
          'vocab-bloom-hub-en-phrasal-verbs.jsonl': { lines: 2 },
          'vocab-bloom-hub-en-grammar-patterns.jsonl': { lines: 1 },
          'vocab-bloom-hub-en-phrases.jsonl': { lines: 1 },
        },
      });

    const runImport = async (withManifest = true): Promise<FakeProgressRes> => {
      mockDatasetFiles({
        ...(withManifest && { 'manifest.json': makeManifest() }),
        'vocab-bloom-hub-en-words.jsonl':
          toNdjson([
            makeSetWord('give', {
              meanings: [
                {
                  title: 'to hand over',
                  definition: 'to pass something to someone',
                  sort_order: 1,
                  is_obsolete: false,
                  examples: ['give me the book'],
                  // the headword, a phrase from the last dataset file and an
                  // unknown word: only the phrase becomes a link (issue #259)
                  synonyms: [
                    { word: 'Give', part_of_speech: EnPartOfSpeechE.verb },
                    { word: 'in the long run', part_of_speech: EnPartOfSpeechE.phrase },
                    { word: 'hand over', part_of_speech: EnPartOfSpeechE.verb },
                    // a spelling variant of the phrasal verb from the same file
                    { word: 'give-up', part_of_speech: EnPartOfSpeechE.verb },
                  ],
                  // an antonym is resolved the same way; a word already linked
                  // as a synonym is skipped rather than stored twice (issue #266)
                  antonyms: [
                    { word: 'would rather + verb', part_of_speech: EnPartOfSpeechE.grammar_pattern },
                    { word: 'in the long run', part_of_speech: EnPartOfSpeechE.phrase },
                  ],
                  area_variant: '',
                  language_register: '',
                  meaning_level: '',
                  categories: [],
                  translations: [
                    {
                      language: AvailableTranslationLanguagesE.ru,
                      title: 'давать',
                      definition: 'передавать',
                      variants_of_words: ['давать'],
                    },
                  ],
                },
              ],
              short_translations: [
                {
                  language: AvailableTranslationLanguagesE.ru,
                  description: 'давать',
                  variants_of_words: ['давать'],
                },
              ],
            }),
            // a duplicate line: the importer must swallow word_already_exists and continue
            makeSetWord('give'),
            makeSetWord('give up', { verb___is_phrasal: true }),
          ]) + '\n\n', // trailing blank lines must be skipped
        'vocab-bloom-hub-en-phrasal-verbs.jsonl': toNdjson([
          makeSetWord('give', { phrasal_variants: ['give up', 'vanish away'] }),
          // base verb missing in the dataset — the whole line is skipped
          makeSetWord('missing', { phrasal_variants: ['give up'] }),
        ]),
        'vocab-bloom-hub-en-grammar-patterns.jsonl': toNdjson([
          makeSetPhrase('would rather + verb', { pattern: ['would rather', 'verb'] }),
        ]),
        'vocab-bloom-hub-en-phrases.jsonl': toNdjson([
          makeSetPhrase('in the long run', {
            meanings: [
              {
                title: 'eventually',
                definition: 'over a long period of time',
                sort_order: 1,
                is_obsolete: false,
                examples: [],
                // the plain-string form of files exported before the part of speech was added
                synonyms: ['give up'],
                area_variant: '',
                language_register: '',
                meaning_level: '',
                categories: [],
                translations: [],
              },
              // a dataset line written before synonyms existed must still import
              {
                title: 'legacy meaning',
                definition: 'without a synonyms field',
                sort_order: 2,
                is_obsolete: false,
                examples: [],
                area_variant: '',
                language_register: '',
                meaning_level: '',
                categories: [],
                translations: [],
              },
            ],
          }),
        ]),
      });

      const res = new FakeProgressRes();
      await service.importDictionary({}, res as unknown as ExpressResponse);
      return res;
    };

    it('saves words, phrases and grammar patterns from the dataset files', async () => {
      await runImport();

      const words = await ds.getRepository(EnWord).find({ relations: { word: true } });
      expect(words).toHaveLength(4);
      const byWord = new Map(words.map((w) => [w.word.word, w]));
      expect(byWord.get('give')?.part_of_speech).toBe(EnPartOfSpeechE.verb);
      expect(byWord.get('give up')?.verb___is_phrasal).toBe(true);
      expect(byWord.get('in the long run')?.part_of_speech).toBe(EnPartOfSpeechE.phrase);
      expect(byWord.get('would rather + verb')?.part_of_speech).toBe(EnPartOfSpeechE.grammar_pattern);
      expect(byWord.get('would rather + verb')?.pattern).toEqual(['would rather', 'verb']);

      // entry types follow the dataset file the record came from
      const entries = await ds.getRepository(EnEntry).find();
      const entryTypes = new Map(entries.map((e) => [e.word, e.type]));
      expect(entryTypes.get('in the long run')).toBe(EnEntryTypesE.phrase);
      expect(entryTypes.get('would rather + verb')).toBe(EnEntryTypesE.grammar_pattern);

      // nested structures came through EnService.addWord
      expect(await ds.getRepository(EnMeaning).count()).toBe(3);
      expect(await ds.getRepository(EnMeaningTranslation).count()).toBe(1);
      expect(await ds.getRepository(EnShortTranslation).count()).toBe(1);
    });

    it('links phrasal variants to their base verb and skips unknown words', async () => {
      await runImport();

      const giveUp = await ds
        .getRepository(EnWord)
        .createQueryBuilder('w')
        .innerJoin('w.word', 'entry')
        .leftJoinAndSelect('w.base_phrasal', 'bp')
        .leftJoinAndSelect('bp.word', 'bpEntry')
        .where('entry.word = :word', { word: 'give up' })
        .getOneOrFail();

      expect(giveUp.base_phrasal?.word.word).toBe('give');
      // neither the missing base verb nor the unknown variant created rows
      expect(await ds.getRepository(EnWord).count()).toBe(4);
    });

    it('links meaning synonyms once every file is in and skips unknown words (issue #259)', async () => {
      const res = await runImport();

      const meanings = await ds.getRepository(EnMeaning).find({ relations: { synonyms: true } });
      const byTitle = new Map(meanings.map((m) => [m.title, m.synonyms.map((e) => e.word).sort()]));
      // "in the long run" is imported after "give", yet the link resolves; the
      // headword and the unknown word are dropped
      expect(byTitle.get('to hand over')).toEqual(['give up', 'in the long run']);
      expect(byTitle.get('eventually')).toEqual(['give up']);
      expect(byTitle.get('legacy meaning')).toEqual([]);
      // no stub entries were created for unknown synonyms
      expect(await ds.getRepository(EnEntry).findOneBy({ word: 'hand over' })).toBeNull();
      const stages = res.chunks.map((c) => (JSON.parse(c) as ProgressChunk).stage);
      expect(stages).toContain(EnDictionaryImportPhasesE.linking_synonyms);
      // the linking stage counts into the progress total: its chunks stay
      // within 100% and its batch report lands exactly where the antonym
      // stage (the last one, issue #266) starts
      const chunks = res.chunks.map((c) => JSON.parse(c) as ProgressChunk);
      const linking = chunks.filter((c) => c.stage === EnDictionaryImportPhasesE.linking_synonyms);
      expect(linking.length).toBeGreaterThanOrEqual(2);
      const lines = 3 + 2 + 1 + 1;
      expect(Math.max(...linking.map((c) => c.percent))).toBeCloseTo(((lines + 4) / (lines + 4 + 2)) * 100);
      expect(linking.every((c) => c.percent <= 100)).toBe(true);
      expect(chunks.find((c) => c.stage === EnDictionaryImportPhasesE.linking_antonyms)?.percent).toBeCloseTo(
        ((lines + 4) / (lines + 4 + 2)) * 100,
      );
    });

    it('links meaning antonyms after the synonyms and never stores a word as both (issue #266)', async () => {
      const res = await runImport();

      const meanings = await ds.getRepository(EnMeaning).find({ relations: { antonyms: true } });
      const byTitle = new Map(meanings.map((m) => [m.title, m.antonyms.map((e) => e.word).sort()]));
      expect(byTitle.get('to hand over')).toEqual(['would rather + verb']);
      // lines without an antonyms key (older datasets) import with none
      expect(byTitle.get('eventually')).toEqual([]);
      expect(byTitle.get('legacy meaning')).toEqual([]);

      const stages = res.chunks.map((c) => (JSON.parse(c) as ProgressChunk).stage);
      expect(stages.lastIndexOf(EnDictionaryImportPhasesE.linking_synonyms)).toBeLessThan(
        stages.indexOf(EnDictionaryImportPhasesE.linking_antonyms),
      );
      const linking = res.chunks
        .map((c) => JSON.parse(c) as ProgressChunk)
        .filter((c) => c.stage === EnDictionaryImportPhasesE.linking_antonyms);
      expect(Math.max(...linking.map((c) => c.percent))).toBe(100);
    });

    it('tolerates duplicate lines instead of aborting the import', async () => {
      await runImport();

      const giveRows = await ds
        .getRepository(EnWord)
        .createQueryBuilder('w')
        .innerJoin('w.word', 'entry')
        .where('entry.word = :word', { word: 'give' })
        .getCount();
      expect(giveRows).toBe(1);
    });

    it('streams NDJSON progress and finishes the response with a completed chunk', async () => {
      const res = await runImport();

      expect(res.ended).toBe(true);
      for (const chunk of res.chunks) {
        expect(chunk.endsWith('\n')).toBe(true);
        expect(() => JSON.parse(chunk)).not.toThrow();
      }

      const parsed = res.chunks.map((c) => JSON.parse(c) as ProgressChunk);
      const stages = new Set(parsed.map((c) => c.stage));
      expect(stages).toContain(EnDictionaryImportPhasesE.downloading_database);
      expect(stages).toContain(EnDictionaryImportPhasesE.completed);

      const finalChunk = parsed[parsed.length - 1];
      expect(finalChunk).toEqual({
        percent: 100,
        stage: EnDictionaryImportPhasesE.completed,
        datasetVersion: '0.2.0',
      });

      // download progress carries byte counters
      const downloadChunk = parsed.find((c) => c.downloaded !== undefined);
      expect(downloadChunk?.total).toBeGreaterThan(0);
    });

    it('reports the manifest dataset version and stores it after a successful import', async () => {
      const res = await runImport();

      const firstChunk = JSON.parse(res.chunks[0]) as ProgressChunk;
      expect(firstChunk.datasetVersion).toBe('0.2.0');

      expect(mockUpsert).toHaveBeenCalledWith(DATASET_VERSION_SETTINGS_FIELD, '0.2.0');
    });

    it('falls back to the legacy totals when the manifest is missing', async () => {
      const res = await runImport(false);

      // the import still completes on the legacy line counts
      expect(await ds.getRepository(EnWord).count()).toBe(4);
      const parsed = res.chunks.map((c) => JSON.parse(c) as ProgressChunk);
      expect(parsed[parsed.length - 1].stage).toBe(EnDictionaryImportPhasesE.completed);

      // no manifest — no version to report or persist
      expect(parsed.every((c) => c.datasetVersion === undefined)).toBe(true);
      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });

  describe('getManifest (issue #197)', () => {
    const manifestBody = () =>
      JSON.stringify({
        version: '0.3.0',
        files: { 'vocab-bloom-hub-en-words.jsonl': { lines: 10 } },
      });

    it('returns the published manifest', async () => {
      mockDatasetFiles({ 'manifest.json': manifestBody() });

      const manifest = await service.getManifest();

      expect(manifest.version).toBe('0.3.0');
      expect(manifest.files['vocab-bloom-hub-en-words.jsonl']).toEqual({ lines: 10 });
    });

    it('caches the manifest instead of re-fetching it on every call', async () => {
      mockDatasetFiles({ 'manifest.json': manifestBody() });

      await service.getManifest();
      await service.getManifest();

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when no manifest is published', async () => {
      mockDatasetFiles({}); // manifest responds with 404

      await expect(service.getManifest()).rejects.toThrow(NotFoundException);
    });
  });

  describe('failure paths', () => {
    it('throws InternalServerErrorException when the dataset download fails', async () => {
      mockDatasetFiles({}); // every file responds with 404

      await expect(
        service.importDictionary({}, new FakeProgressRes() as unknown as ExpressResponse),
      ).rejects.toThrow(InternalServerErrorException);

      expect(await ds.getRepository(EnWord).count()).toBe(0);
    });

    it('aborts on a non-duplicate save error instead of swallowing it', async () => {
      mockDatasetFiles({
        'vocab-bloom-hub-en-words.jsonl': toNdjson([
          // sort_order is NOT NULL — the meaning save fails mid-import
          makeSetWord('broken', {
            meanings: [
              {
                title: 'broken meaning',
                definition: 'no sort order',
                sort_order: null,
                is_obsolete: false,
                examples: [],
                area_variant: '',
                language_register: '',
                meaning_level: '',
                categories: [],
                translations: [],
              },
            ],
          }),
        ]),
      });

      await expect(
        service.importDictionary({}, new FakeProgressRes() as unknown as ExpressResponse),
      ).rejects.toThrow(InternalServerErrorException);

      // the failed word rolled back entirely
      expect(await ds.getRepository(EnWord).count()).toBe(0);
      expect(await ds.getRepository(EnMeaning).count()).toBe(0);
    });
  });

  describe('local sources (issue #269)', () => {
    let root: string;
    const originalImportDir = process.env.DICTIONARY_IMPORT_DIR;

    const datasetFiles = (): Record<string, string> => ({
      'manifest.json': JSON.stringify({
        version: '0.4.0',
        files: {
          'vocab-bloom-hub-en-words.jsonl': { lines: 2 },
          'vocab-bloom-hub-en-phrasal-verbs.jsonl': { lines: 1 },
          'vocab-bloom-hub-en-grammar-patterns.jsonl': { lines: 0 },
          'vocab-bloom-hub-en-phrases.jsonl': { lines: 1 },
        },
        synonym_links: 1,
      }),
      'vocab-bloom-hub-en-words.jsonl': toNdjson([
        makeSetWord('give', {
          meanings: [
            {
              title: 'to hand over',
              definition: 'to pass something to someone',
              sort_order: 1,
              is_obsolete: false,
              examples: [],
              synonyms: ['in the long run'],
              area_variant: '',
              language_register: '',
              meaning_level: '',
              categories: [],
              translations: [],
            },
          ],
        }),
        makeSetWord('give up', { verb___is_phrasal: true }),
      ]),
      'vocab-bloom-hub-en-phrasal-verbs.jsonl': toNdjson([
        makeSetWord('give', { phrasal_variants: ['give up'] }),
      ]),
      'vocab-bloom-hub-en-grammar-patterns.jsonl': '',
      'vocab-bloom-hub-en-phrases.jsonl': toNdjson([makeSetPhrase('in the long run')]),
    });

    const writeDataset = async (dir: string): Promise<void> => {
      await mkdir(dir, { recursive: true });
      for (const [name, body] of Object.entries(datasetFiles())) await writeFile(path.join(dir, name), body);
    };

    const zipDataset = (zipPath: string, prefix = ''): Promise<void> =>
      new Promise((resolve, reject) => {
        const zip = new yazl.ZipFile();
        for (const [name, body] of Object.entries(datasetFiles()))
          zip.addBuffer(Buffer.from(body), prefix + name);
        const out = createWriteStream(zipPath);
        out.on('close', resolve);
        out.on('error', reject);
        zip.outputStream.pipe(out);
        zip.end();
      });

    const expectImported = async (res: FakeProgressRes): Promise<void> => {
      const words = await ds.getRepository(EnWord).find({ relations: { word: true } });
      expect(words.map((w) => w.word.word).sort()).toEqual(['give', 'give up', 'in the long run']);
      const meanings = await ds.getRepository(EnMeaning).find({ relations: { synonyms: true } });
      expect(meanings.map((m) => m.synonyms.map((e) => e.word))).toEqual([['in the long run']]);
      expect(mockUpsert).toHaveBeenCalledWith(DATASET_VERSION_SETTINGS_FIELD, '0.4.0');

      const chunks = res.chunks.map((c) => JSON.parse(c) as ProgressChunk);
      // nothing is downloaded: the stream opens straight on the words stage
      expect(chunks[0]).toEqual({
        percent: 0,
        stage: EnDictionaryImportPhasesE.saving_words,
        datasetVersion: '0.4.0',
      });
      expect(chunks.some((c) => c.stage === EnDictionaryImportPhasesE.downloading_database)).toBe(false);
      expect(chunks[chunks.length - 1]).toEqual({
        percent: 100,
        stage: EnDictionaryImportPhasesE.completed,
        datasetVersion: '0.4.0',
      });
      expect(res.ended).toBe(true);
    };

    beforeAll(async () => {
      root = await mkdtemp(path.join(os.tmpdir(), 'vocab-bloom-import-spec-'));
      process.env.DICTIONARY_IMPORT_DIR = root;
    });

    afterAll(async () => {
      if (originalImportDir === undefined) delete process.env.DICTIONARY_IMPORT_DIR;
      else process.env.DICTIONARY_IMPORT_DIR = originalImportDir;
      await rm(root, { recursive: true, force: true });
    });

    it('imports a dataset directory from DICTIONARY_IMPORT_DIR without touching the network or the files', async () => {
      await writeDataset(path.join(root, 'dataset'));
      const fetchSpy = jest.spyOn(globalThis, 'fetch');

      const res = new FakeProgressRes();
      await service.importDictionary(
        { source: { kind: ImportSourceKindE.file, path: 'dataset' } },
        res as unknown as ExpressResponse,
      );

      await expectImported(res);
      expect(fetchSpy).not.toHaveBeenCalled();
      // the user's files are still there after the import
      expect((await readdir(path.join(root, 'dataset'))).sort()).toEqual(Object.keys(datasetFiles()).sort());
    });

    it('imports a zip archive from DICTIONARY_IMPORT_DIR and removes the extracted copy', async () => {
      await zipDataset(path.join(root, 'export.zip'), 'vocab-bloom-hub-en-export/');

      const res = new FakeProgressRes();
      await service.importDictionary(
        { source: { kind: ImportSourceKindE.file, path: 'export.zip' } },
        res as unknown as ExpressResponse,
      );

      await expectImported(res);
      // the archive itself stays; the extracted copy is removed by the
      // source (verified in the sources spec, whose tmp dir is private)
      expect(existsSync(path.join(root, 'export.zip'))).toBe(true);
    });

    it('rejects a bad path before the stream opens, so the client gets a plain 4xx', async () => {
      const res = new FakeProgressRes();
      await expect(
        service.importDictionary(
          { source: { kind: ImportSourceKindE.file, path: '../etc' } },
          res as unknown as ExpressResponse,
        ),
      ).rejects.toThrow(new BadRequestException(ErrorCodes.dataset_file_not_found));
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.chunks).toEqual([]);

      delete process.env.DICTIONARY_IMPORT_DIR;
      await expect(
        service.importDictionary(
          { source: { kind: ImportSourceKindE.file, path: 'dataset' } },
          res as unknown as ExpressResponse,
        ),
      ).rejects.toThrow(new BadRequestException(ErrorCodes.import_dir_not_configured));
      process.env.DICTIONARY_IMPORT_DIR = root;
    });

    it('imports an uploaded archive and deletes the upload afterwards, also when it is rejected', async () => {
      const upload = path.join(root, 'upload-1');
      await zipDataset(upload);

      const res = new FakeProgressRes();
      await service.importUploadedDictionary(
        { archive: [{ path: upload, originalname: 'export.zip' }] },
        {},
        res as unknown as ExpressResponse,
      );

      await expectImported(res);
      expect(existsSync(upload)).toBe(false);

      const bad = path.join(root, 'upload-2');
      await writeFile(bad, 'not a zip');
      const badRes = new FakeProgressRes();
      await expect(
        service.importUploadedDictionary(
          { archive: [{ path: bad, originalname: 'notes.txt' }] },
          {},
          badRes as unknown as ExpressResponse,
        ),
      ).rejects.toThrow(new BadRequestException(ErrorCodes.dataset_invalid));
      expect(badRes.setHeader).not.toHaveBeenCalled();
      expect(existsSync(bad)).toBe(false);
    });

    it('imports the dataset files from their own slots; the manifest and the extra files are optional', async () => {
      // only the words slot, under whatever name the admin's file had: no
      // manifest, so no version is reported or stored, and the progress total
      // comes from the counted lines
      const words = path.join(root, 'upload-words');
      await writeFile(words, datasetFiles()['vocab-bloom-hub-en-words.jsonl']);

      const res = new FakeProgressRes();
      await service.importUploadedDictionary(
        { words: [{ path: words, originalname: 'my-words.jsonl' }] },
        {},
        res as unknown as ExpressResponse,
      );

      const saved = await ds.getRepository(EnWord).find({ relations: { word: true } });
      expect(saved.map((w) => w.word.word).sort()).toEqual(['give', 'give up']);
      expect(mockUpsert).not.toHaveBeenCalled();
      const chunks = res.chunks.map((c) => JSON.parse(c) as ProgressChunk);
      expect(chunks[0]).toEqual({ percent: 0, stage: EnDictionaryImportPhasesE.saving_words });
      expect(chunks[chunks.length - 1]).toEqual({ percent: 100, stage: EnDictionaryImportPhasesE.completed });
      expect(existsSync(words)).toBe(false);

      // a second upload with the manifest and a phrases file on top links the
      // synonym that the words-only import could not resolve
      await ds.synchronize(true);
      const slots: Record<string, string> = {
        manifest: 'manifest.json',
        words: 'vocab-bloom-hub-en-words.jsonl',
        phrasal_verbs: 'vocab-bloom-hub-en-phrasal-verbs.jsonl',
        phrases: 'vocab-bloom-hub-en-phrases.jsonl',
      };
      const files: Record<string, Array<{ path: string; originalname: string }>> = {};
      for (const [slot, name] of Object.entries(slots)) {
        const filePath = path.join(root, `upload-${slot}`);
        await writeFile(filePath, datasetFiles()[name]);
        files[slot] = [{ path: filePath, originalname: `${slot}.bin` }];
      }
      const fullRes = new FakeProgressRes();
      await service.importUploadedDictionary(files, {}, fullRes as unknown as ExpressResponse);
      await expectImported(fullRes);
      expect(Object.values(files).some((f) => existsSync(f[0].path))).toBe(false);

      // an archive next to a slot, two files in one slot, or nothing at all
      const stray = path.join(root, 'upload-stray');
      await writeFile(stray, '');
      const strayZip = path.join(root, 'upload-stray.zip');
      await zipDataset(strayZip);
      await expect(
        service.importUploadedDictionary(
          {
            archive: [{ path: strayZip, originalname: 'export.zip' }],
            words: [{ path: stray, originalname: 'words.jsonl' }],
          },
          {},
          new FakeProgressRes() as unknown as ExpressResponse,
        ),
      ).rejects.toThrow(new BadRequestException(ErrorCodes.dataset_invalid));
      expect(existsSync(stray)).toBe(false);
      expect(existsSync(strayZip)).toBe(false);
      await expect(
        service.importUploadedDictionary({}, {}, new FakeProgressRes() as unknown as ExpressResponse),
      ).rejects.toThrow(new BadRequestException(ErrorCodes.dataset_upload_missing));
    });

    it('takes the manifest values typed by hand, which win over an uploaded manifest.json', async () => {
      const words = path.join(root, 'upload-words-manual');
      await writeFile(words, datasetFiles()['vocab-bloom-hub-en-words.jsonl']);

      const res = new FakeProgressRes();
      await service.importUploadedDictionary(
        { words: [{ path: words, originalname: 'words.jsonl' }] },
        { version: '9.9.9', synonym_links: 1 },
        res as unknown as ExpressResponse,
      );
      const chunks = res.chunks.map((c) => JSON.parse(c) as ProgressChunk);
      expect(chunks[0]).toEqual({
        percent: 0,
        stage: EnDictionaryImportPhasesE.saving_words,
        datasetVersion: '9.9.9',
      });
      expect(mockUpsert).toHaveBeenCalledWith(DATASET_VERSION_SETTINGS_FIELD, '9.9.9');

      await ds.synchronize(true);
      mockUpsert.mockClear();
      const archive = path.join(root, 'upload-manual.zip');
      await zipDataset(archive);
      await service.importUploadedDictionary(
        { archive: [{ path: archive, originalname: 'export.zip' }] },
        { version: '1.2.3' },
        new FakeProgressRes() as unknown as ExpressResponse,
      );
      // the archive's manifest says 0.4.0; the explicit value wins
      expect(mockUpsert).toHaveBeenCalledWith(DATASET_VERSION_SETTINGS_FIELD, '1.2.3');
    });

    it('reports what the import directory offers', async () => {
      await writeDataset(path.join(root, 'dataset'));
      await zipDataset(path.join(root, 'export.zip'));

      const sources = await service.getImportSources();
      expect(sources.import_dir_configured).toBe(true);
      expect(sources.files.map((f) => [f.path, f.kind])).toEqual([
        ['dataset', 'directory'],
        ['export.zip', 'zip'],
      ]);

      delete process.env.DICTIONARY_IMPORT_DIR;
      await expect(service.getImportSources()).resolves.toEqual({ import_dir_configured: false, files: [] });
      process.env.DICTIONARY_IMPORT_DIR = root;
    });
  });
});
