import '../../../__tests__/helpers/clearDatabaseUrl';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { DataSource } from 'typeorm';

import { EnEntry } from '../../../entities/en_entry.entity';
import { EnWord } from '../../../entities/en_word.entity';
import { EnMeaning } from '../../../entities/en_meaning.entity';
import { EnMeaningTranslation } from '../../../entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../../../entities/en_short_translation.entity';
import { EnSearchService } from '../enSearch.service';
import {
  AvailableTranslationLanguagesE,
  EnEntryTypesE,
  EnPartOfSpeechE,
  EnWordFormsE,
} from '../../../../../../types';

describe('EnSearchService tier categorization (issue #187)', () => {
  let ds: DataSource;
  let service: EnSearchService;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [EnEntry, EnWord, EnMeaning, EnMeaningTranslation, EnShortTranslation],
      synchronize: true,
    });
    await ds.initialize();

    service = new EnSearchService(ds.getRepository(EnWord));
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await ds.synchronize(true);
  });

  const addEntry = (word: string, type = EnEntryTypesE.word) => ds.getRepository(EnEntry).save({ word, type });

  const addWord = (
    entry: EnEntry,
    pos: EnPartOfSpeechE,
    formOfWord = EnWordFormsE.base_form,
    extra: Partial<EnWord> = {},
  ) =>
    ds.getRepository(EnWord).save({
      word: entry,
      part_of_speech: pos,
      form_of_word: formOfWord,
      ...extra,
    });

  /**
   * Seeds a dataset around the search term "run" covering every tier:
   * exact matches, phrasal variants, starts-with, phrases, ends-with, any-match.
   */
  const seedRunDataset = async () => {
    const runEntry = await addEntry('run');
    const runVerb = await addWord(runEntry, EnPartOfSpeechE.verb);
    const runNoun = await addWord(runEntry, EnPartOfSpeechE.noun);

    const runOutEntry = await addEntry('run out');
    await addWord(runOutEntry, EnPartOfSpeechE.verb, EnWordFormsE.base_form, {
      verb___is_phrasal: true,
      base_phrasal: runVerb,
    });

    const runningEntry = await addEntry('running');
    await addWord(runningEntry, EnPartOfSpeechE.verb, EnWordFormsE.present_participle, {
      base_form: runVerb,
    });

    await addWord(await addEntry('runner'), EnPartOfSpeechE.noun);
    await addWord(await addEntry('runway'), EnPartOfSpeechE.noun);
    await addWord(await addEntry('overrun'), EnPartOfSpeechE.verb);
    await addWord(await addEntry('brunch'), EnPartOfSpeechE.noun);

    await addWord(await addEntry('run for it', EnEntryTypesE.phrase), EnPartOfSpeechE.phrase);
    await addWord(await addEntry('in the long run', EnEntryTypesE.phrase), EnPartOfSpeechE.phrase);
    await addWord(await addEntry('runaway train', EnEntryTypesE.phrase), EnPartOfSpeechE.phrase);

    return { runVerb, runNoun };
  };

  const words = (res: Awaited<ReturnType<EnSearchService['search']>>) => res.map((w) => w.word);

  it('returns tiers in relevance order: exact, phrasal, starts-with, phrases, ends-with, any', async () => {
    await seedRunDataset();

    const res = await service.search({ search: 'run', type: undefined, limit: 20 });
    const names = words(res);

    // exact matches (both parts of speech of "run") come first
    expect(names.slice(0, 2)).toEqual(['run', 'run']);
    // then phrasal variants of the exact match
    expect(names[2]).toBe('run out');
    // then words starting with the search term
    expect(names.slice(3, 5).sort()).toEqual(['runner', 'runway']);
    // then phrases containing the term on a word boundary
    expect(names.slice(5, 7).sort()).toEqual(['in the long run', 'run for it']);
    // then words ending with the term
    expect(names[7]).toBe('overrun');
    // finally any-match leftovers (substring matches, including phrases)
    expect(names.slice(8).sort()).toEqual(['brunch', 'runaway train']);

    // the word form "running" resolves to its base and never appears on its own
    expect(names).not.toContain('running');
  });

  it('resolves a search by word form to the base word and its phrasal variants', async () => {
    await seedRunDataset();

    const res = await service.search({ search: 'running', type: undefined, limit: 3 });
    const names = words(res);

    expect(names[0]).toBe('run');
    expect(names).toContain('run out');
  });

  it('spends the limit on higher tiers first', async () => {
    await seedRunDataset();

    const res = await service.search({ search: 'run', type: undefined, limit: 3 });

    expect(words(res).sort()).toEqual(['run', 'run', 'run out']);
  });

  it('with type=word skips phrase tiers entirely', async () => {
    await seedRunDataset();

    const res = await service.search({ search: 'run', type: EnEntryTypesE.word, limit: 20 });
    const names = words(res);

    expect(names).toContain('runner');
    expect(names).toContain('overrun');
    expect(names).not.toContain('run for it');
    expect(names).not.toContain('in the long run');
    expect(names).not.toContain('runaway train');
  });

  it('with type=phrase returns only phrases matched on word boundaries', async () => {
    await seedRunDataset();

    const res = await service.search({ search: 'long', type: EnEntryTypesE.phrase, limit: 20 });

    expect(words(res)).toEqual(['in the long run']);
  });

  it('with type=grammar_pattern returns only grammar patterns', async () => {
    await seedRunDataset();
    await addWord(await addEntry('let it run', EnEntryTypesE.grammar_pattern), EnPartOfSpeechE.grammar_pattern);

    const res = await service.search({ search: 'let', type: EnEntryTypesE.grammar_pattern, limit: 20 });

    expect(words(res)).toEqual(['let it run']);
  });

  it('normalizes the search term (trim + lowercase)', async () => {
    await seedRunDataset();

    const res = await service.search({ search: '  RUN  ', type: undefined, limit: 2 });

    expect(words(res)).toEqual(['run', 'run']);
  });

  it('escapes LIKE wildcards in the search term', async () => {
    await addWord(await addEntry('axc'), EnPartOfSpeechE.noun);
    await addWord(await addEntry('abbbc'), EnPartOfSpeechE.noun);

    // "_" and "%" must be treated literally, not as LIKE wildcards
    expect(await service.search({ search: 'a_c', type: undefined, limit: 10 })).toEqual([]);
    expect(await service.search({ search: 'a%c', type: undefined, limit: 10 })).toEqual([]);
  });

  it('returns an empty list when nothing matches', async () => {
    await seedRunDataset();

    expect(await service.search({ search: 'zzz', type: undefined, limit: 10 })).toEqual([]);
  });

  describe('searchDetailed (issue #170)', () => {
    const seedTranslations = async (word: EnWord) => {
      await ds.getRepository(EnShortTranslation).save({
        word,
        description: 'бежать',
        language: AvailableTranslationLanguagesE.ru,
        variants_of_words: ['бежать', 'бегать'],
      });
      const meaning = await ds.getRepository(EnMeaning).save({
        word,
        sort_order: 0,
        title: 'to move fast',
        definition: 'to move at a speed faster than a walk',
        is_obsolete: false,
      });
      await ds.getRepository(EnMeaningTranslation).save({
        meaning,
        language: AvailableTranslationLanguagesE.ru,
        title: 'бежать',
        definition: 'быстро передвигаться',
        variants_of_words: [],
      });
    };

    it('without flags returns items with empty meanings and translations plus paging meta', async () => {
      const { runVerb } = await seedRunDataset();
      await seedTranslations(runVerb);

      const res = await service.searchDetailed({ search: 'run', limit: 5, page: 1 });

      expect(res.page).toBe(1);
      expect(res.limit).toBe(5);
      expect(res.has_more).toBe(true);
      expect(res.items.length).toBe(5);
      res.items.forEach((item) => {
        expect(item.meanings).toEqual([]);
        expect(item.short_translations).toEqual([]);
      });
    });

    it('with_translations populates short translations of the found word', async () => {
      const { runVerb } = await seedRunDataset();
      await seedTranslations(runVerb);

      const res = await service.searchDetailed({ search: 'run', limit: 5, with_translations: true });

      const verb = res.items.find((item) => item.id === runVerb.id);
      expect(verb?.short_translations.map((st) => st.description)).toEqual(['бежать']);
      // meanings stay empty without their flag
      expect(verb?.meanings).toEqual([]);
    });

    it('with_meanings populates meanings together with their translations', async () => {
      const { runVerb } = await seedRunDataset();
      await seedTranslations(runVerb);

      const res = await service.searchDetailed({
        search: 'run',
        limit: 5,
        with_meanings: true,
        translation_languages: [AvailableTranslationLanguagesE.ru],
      });

      const verb = res.items.find((item) => item.id === runVerb.id);
      expect(verb?.meanings.map((m) => m.title)).toEqual(['to move fast']);
      expect(verb?.meanings[0].translations.map((t) => t.definition)).toEqual(['быстро передвигаться']);
    });

    it('paginates the tiered results without overlaps and reports has_more', async () => {
      await seedRunDataset(); // 10 matches for "run" in total

      const page1 = await service.searchDetailed({ search: 'run', limit: 3, page: 1 });
      const page2 = await service.searchDetailed({ search: 'run', limit: 3, page: 2 });
      const page4 = await service.searchDetailed({ search: 'run', limit: 3, page: 4 });

      // page 1 is the top of the tier order, identical to the base search
      expect(page1.items.map((w) => w.word)).toEqual(['run', 'run', 'run out']);
      expect(page1.has_more).toBe(true);

      expect(page2.items).toHaveLength(3);
      const page1Ids = new Set(page1.items.map((w) => w.id));
      page2.items.forEach((w) => expect(page1Ids.has(w.id)).toBe(false));

      // 10 items with limit 3 leave a single item on the last page
      expect(page4.items).toHaveLength(1);
      expect(page4.has_more).toBe(false);
    });

    it('returns an empty page when nothing matches', async () => {
      await seedRunDataset();

      const res = await service.searchDetailed({ search: 'zzz' });

      expect(res.items).toEqual([]);
      expect(res.has_more).toBe(false);
    });
  });
});
