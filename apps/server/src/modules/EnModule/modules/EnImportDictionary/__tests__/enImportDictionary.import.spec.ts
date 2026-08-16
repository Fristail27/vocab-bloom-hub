import '../../../__tests__/helpers/clearDatabaseUrl';

import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { type Response as ExpressResponse } from 'express';

import { EnEntry } from '../../../entities/en_entry.entity';
import { EnWord } from '../../../entities/en_word.entity';
import { EnMeaning } from '../../../entities/en_meaning.entity';
import { EnMeaningTranslation } from '../../../entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../../../entities/en_short_translation.entity';
import { EnImportDictionaryService } from '../enImportDictionary.service';
import { SettingsService } from '../../../../SettingsModule/settings.service';
import { DATASET_VERSION_SETTINGS_FIELD, EnDictionaryImportPhasesE } from '../constants';
import { AvailableTranslationLanguagesE, EnEntryTypesE, EnPartOfSpeechE } from '../../../../../../types';

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
        'vocab-bloom-hub-en-phrases.jsonl': toNdjson([makeSetPhrase('in the long run')]),
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
      expect(await ds.getRepository(EnMeaning).count()).toBe(1);
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
});
