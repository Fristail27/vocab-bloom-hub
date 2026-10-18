import { DataSource } from 'typeorm';
import { DICTIONARY_ENTITIES } from '../../../entities/dictionary-entities';
import { EnEntry } from '../../../entities/en_entry.entity';
import { EnWord } from '../../../entities/en_word.entity';
import { EnMeaning } from '../../../entities/en_meaning.entity';
import { EnMeaningTranslation } from '../../../entities/en_meaning_translation.entity';
import { AvailableTranslationLanguagesE } from '../../../../../../types';
import { EnAreaVariantsE, EnPartOfSpeechE, EnWordFormsE } from '../../../../../../types';
import { alignUnchangedRecords, dictionaryRecords, wordDocument } from '../snapshot';
import { contentHash } from '../compare';
import type { SnapshotRecordT } from '../store';
import { WORD_CHANGE_RELATIONS } from '../../../utils/changes/words';
import { EnEtymology } from '../../../entities/en_etymology.entity';
import { EnPronunciation } from '../../../entities/en_pronunciation.entity';
import { EnPronunciationAudio } from '../../../entities/en_pronunciation_audio.entity';
import { EnShortTranslation } from '../../../entities/en_short_translation.entity';

describe('portable dictionary snapshots', () => {
  let db: DataSource;
  beforeEach(async () => {
    db = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: DICTIONARY_ENTITIES,
      synchronize: true,
    }).initialize();
  });
  afterEach(async () => {
    await db.destroy();
  });

  async function snapshot() {
    return db.transaction(async (em) => {
      const records: SnapshotRecordT[] = [];
      for await (const record of dictionaryRecords(em)) records.push(record);
      return records;
    });
  }

  it('retains meaning identity across edits and never reuses a deleted row identity', async () => {
    const entry = await db.manager.save(EnEntry, { word: 'test' });
    const word = await db.manager.save(EnWord, {
      word: entry,
      part_of_speech: EnPartOfSpeechE.noun,
      form_of_word: EnWordFormsE.base_form,
      generated: false,
    });
    const meaning = await db.manager.save(EnMeaning, {
      word,
      title: 'first',
      definition: 'original',
      sort_order: 0,
      is_obsolete: false,
      area_variant: EnAreaVariantsE.common,
      examples: [],
    });
    const first = await snapshot();
    const identified = await db.manager.findOneByOrFail(EnMeaning, { id: meaning.id });
    expect(identified.sync_id).toMatch(/^[\da-f-]{36}$/);
    expect((await snapshot()).map((row) => contentHash(row.content))).toEqual(
      first.map((row) => contentHash(row.content)),
    );
    await db.manager.update(
      EnMeaning,
      { id: meaning.id },
      { title: 'renamed', definition: 'edited', sort_order: 2 },
    );
    const second = await snapshot();
    expect(JSON.stringify(second)).toContain(identified.sync_id!);
    expect(JSON.stringify(second)).toContain('edited');
    await db.manager.delete(EnMeaning, { id: meaning.id });
    await db.manager.save(EnMeaning, { ...meaning, id: meaning.id, title: 'new', sync_id: null });
    await snapshot();
    expect((await db.manager.findOneByOrFail(EnMeaning, { id: meaning.id })).sync_id).not.toBe(
      identified.sync_id,
    );
  });

  it('matches only unchanged unambiguous records when incoming IDs are foreign', () => {
    expect(
      alignUnchangedRecords(
        { a: { text: 'same' }, b: { text: 'before' } },
        { foreign: { text: 'same' }, new: { text: 'after' } },
      ),
    ).toEqual({ a: { text: 'same' }, new: { text: 'after' } });
    expect(
      alignUnchangedRecords({ a: { text: 'same' }, b: { text: 'same' } }, { foreign: { text: 'same' } }),
    ).toEqual({ foreign: { text: 'same' } });
  });

  it('preserves the complete entity snapshot when loading relations in batches', async () => {
    const entry = await db.manager.save(EnEntry, { word: 'run' });
    const alternative = await db.manager.save(EnEntry, { word: 'sprint' });
    await db.manager.save(EnEntry, { ...entry, alternatives: [alternative] });
    const word = await db.manager.save(EnWord, {
      word: entry,
      part_of_speech: EnPartOfSpeechE.verb,
      form_of_word: EnWordFormsE.base_form,
      generated: false,
    });
    const form = await db.manager.save(EnWord, {
      word: await db.manager.save(EnEntry, { word: 'ran', alternatives: [alternative] }),
      base_form: word,
      part_of_speech: EnPartOfSpeechE.verb,
      form_of_word: EnWordFormsE.past_simple,
      generated: false,
    });
    const etymology = await db.manager.save(EnEtymology, { word, number: 1, text: 'Invented etymology' });
    const meaning = await db.manager.save(EnMeaning, {
      word,
      etymology,
      title: 'move',
      definition: 'Invented definition',
      sort_order: 0,
      is_obsolete: false,
      examples: [],
      synonyms: [alternative],
      antonyms: [],
    });
    await db.manager.save(EnMeaningTranslation, {
      meaning,
      language: AvailableTranslationLanguagesE.ru,
      title: 'бежать',
      definition: 'двигаться',
    });
    await db.manager.save(EnShortTranslation, {
      word,
      language: AvailableTranslationLanguagesE.ru,
      description: 'бежать',
    });
    for (const owner of [word, form]) {
      const pronunciation = await db.manager.save(EnPronunciation, {
        word: owner,
        type: 'ipa',
        text: 'test',
        area_variant: EnAreaVariantsE.common,
        sort_order: 0,
      });
      await db.manager.save(EnPronunciationAudio, {
        pronunciation,
        url: 'https://example.org/test.ogg',
        sort_order: 0,
        licenses: [{ spdx: 'CC0-1.0', name: 'CC0' }],
      });
    }
    const records = await snapshot();
    expect(records).toHaveLength(1); // Form-only spellings are not separate articles.
    await db.transaction(async (em) => {
      const hydrated = await em.findOneOrFail(EnWord, {
        where: { id: word.id },
        relations: WORD_CHANGE_RELATIONS,
        relationLoadStrategy: 'query',
      });
      expect(records[0].content).toEqual({
        alternatives: ['sprint'],
        parts: { verb: await wordDocument(em, hydrated) },
      });
    });
  });

  it('reads multiple pages and assigns legacy identities without a query per word or changing timestamps', async () => {
    await db.transaction(async (em) => {
      for (let i = 0; i < 205; i++) {
        const entry = await em.save(EnEntry, { word: `word${String(i).padStart(3, '0')}` });
        const word = await em.save(EnWord, {
          word: entry,
          part_of_speech: EnPartOfSpeechE.noun,
          form_of_word: EnWordFormsE.base_form,
          generated: false,
        });
        const meaning = await em.save(EnMeaning, {
          word,
          title: `meaning ${i}`,
          definition: 'definition',
          sort_order: 0,
          is_obsolete: false,
          examples: [],
        });
        await em.save(EnMeaningTranslation, {
          meaning,
          language: AvailableTranslationLanguagesE.ru,
          title: `translation ${i}`,
          definition: `definition ${i}`,
        });
      }
    });
    const before = (await db.manager.find(EnMeaning)).map((row) => row.updateAt);
    const queries = jest.spyOn(db.logger, 'logQuery').mockImplementation(() => {});
    try {
      const first = await snapshot();
      expect(first).toHaveLength(205);
      expect(queries.mock.calls.length).toBeLessThan(120);
      const meanings = await db.manager.find(EnMeaning);
      expect(meanings.map((row) => row.updateAt)).toEqual(before);
      const ids = [...meanings, ...(await db.manager.find(EnMeaningTranslation))].map((row) => row.sync_id);
      expect(ids.every((id) => /^[\da-f-]{36}$/.test(id!))).toBe(true);
      expect(new Set(ids).size).toBe(410);
      expect(JSON.stringify(first[204].content)).toContain('translation 204');
      queries.mockClear();
      expect(await snapshot()).toEqual(first);
      expect(queries.mock.calls.length).toBeLessThan(100);
      expect(queries.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
    } finally {
      queries.mockRestore();
    }
  });
});
