import '../../../__tests__/helpers/clearDatabaseUrl';

import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { type Response as ExpressResponse } from 'express';

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
import { EnDictionaryImportPhasesE } from '../constants';
import { AvailableTranslationLanguagesE, EnEntryTypesE, EnPartOfSpeechE } from '../../../../../../types';

type ProgressChunk = {
  percent: number;
  stage: EnDictionaryImportPhasesE;
  downloaded?: number;
  total?: number;
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

    service = new EnImportDictionaryService(ds.getRepository(EnWord), enService);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await ds.synchronize(true);
  });

  describe('full import flow', () => {
    const runImport = async (): Promise<FakeProgressRes> => {
      mockDatasetFiles({
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
      expect(finalChunk).toEqual({ percent: 100, stage: EnDictionaryImportPhasesE.completed });

      // download progress carries byte counters
      const downloadChunk = parsed.find((c) => c.downloaded !== undefined);
      expect(downloadChunk?.total).toBeGreaterThan(0);
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
