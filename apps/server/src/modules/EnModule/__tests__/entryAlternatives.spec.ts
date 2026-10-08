import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { DICTIONARY_ENTITIES } from '../entities/dictionary-entities';
import { EnEntry } from '../entities/en_entry.entity';
import { EnWord } from '../entities/en_word.entity';
import { alternativeSpellings, replaceAlternatives } from '../utils/entryAlternatives';
import { WordRowsService } from '../word-rows.service';
import { FULL_WORD_RELATIONS, RELATION_LOAD_STRATEGY } from '../utils/wordRelations';
import { prepareWordFromDB } from '../utils/prepareWordFromDB';
import { prepareWordForDataSet } from '../modules/EnImportDictionary/utils/prepareWordForDataSet';
import { toPublicSearchWord } from '../../PublicApiModule/utils/projection';
import { EnPartOfSpeechE, EnWordFormsE } from '../../../../types';
import { fullWordSnapshot } from '../utils/changes/snapshots';

// Invented spellings: relation behavior does not depend on source dictionary text.
describe('alternative spellings at headword level (#575)', () => {
  let ds: DataSource;
  beforeEach(async () => {
    ds = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: DICTIONARY_ENTITIES,
      synchronize: true,
    }).initialize();
    await ds.getRepository(EnEntry).insert(['luma', 'lumah', 'Luma', 'lumma'].map((word) => ({ word })));
    for (const pos of [EnPartOfSpeechE.noun, EnPartOfSpeechE.verb]) {
      await ds
        .getRepository(EnWord)
        .save({ word: { word: 'luma' }, part_of_speech: pos, form_of_word: EnWordFormsE.base_form });
    }
  });
  afterEach(async () => ds.destroy());
  const links = async (word: string) =>
    alternativeSpellings(
      await ds.getRepository(EnEntry).findOneOrFail({ where: { word }, relations: { alternatives: true } }),
    );

  it('is reciprocal, exact-case and shared by POS, without self-links, duplicates or inferred transitivity', async () => {
    await ds.transaction((em) =>
      replaceAlternatives(
        em,
        new Map([
          ['luma', ['lumah', 'lumah', 'luma', 'missing', 'Luma']],
          ['lumah', ['lumma']],
        ]),
      ),
    );
    expect(await links('luma')).toEqual(['Luma', 'lumah']);
    expect(await links('lumah')).toEqual(['luma', 'lumma']);
    expect(await links('lumma')).toEqual(['lumah']);
    const repository = ds.getRepository(EnWord);
    const ids = (await repository.find()).map((word) => word.id);
    const raw = await new WordRowsService(ds).load(ids, FULL_WORD_RELATIONS);
    const entities = await repository.find({
      relations: FULL_WORD_RELATIONS,
      relationLoadStrategy: RELATION_LOAD_STRATEGY,
      order: { id: 'ASC' },
    });
    expect(JSON.parse(JSON.stringify(raw))).toEqual(JSON.parse(JSON.stringify(entities)));
    for (const word of raw) {
      expect(prepareWordFromDB(word).alternatives).toEqual(['Luma', 'lumah']);
      expect(toPublicSearchWord(word).alternatives).toEqual(['Luma', 'lumah']);
      expect(prepareWordForDataSet(word).alternatives).toEqual(['Luma', 'lumah']);
      expect(fullWordSnapshot(word).alternatives).toEqual(['Luma', 'lumah']);
    }
  });

  it('replaces explicit lists together, preserves legacy omitted lists and protected endpoints', async () => {
    await ds.transaction((em) => replaceAlternatives(em, new Map([['luma', ['lumah', 'Luma']]])));
    await ds.getRepository(EnEntry).update('lumah', { user_modified: true });
    await ds.transaction((em) => replaceAlternatives(em, new Map([['luma', []]]), true));
    expect(await links('luma')).toEqual(['lumah']);
    expect(await links('Luma')).toEqual([]);
    await ds.transaction((em) => replaceAlternatives(em, new Map([['lumah', ['lumma']]]), true));
    expect(await links('lumah')).toEqual(['luma']);
    await ds.transaction((em) => replaceAlternatives(em, new Map()));
    expect(await links('luma')).toEqual(['lumah']);
  });

  it('keeps links when one POS is deleted and cascades both directions only when the headword goes', async () => {
    await ds.transaction((em) => replaceAlternatives(em, new Map([['luma', ['lumah']]])));
    await ds.getRepository(EnWord).delete({ part_of_speech: EnPartOfSpeechE.verb });
    expect(await links('luma')).toEqual(['lumah']);
    await ds.getRepository(EnEntry).delete('lumah');
    expect(await links('luma')).toEqual([]);
    expect(await ds.query('SELECT * FROM en_entry_alternatives')).toEqual([]);
  });
});
