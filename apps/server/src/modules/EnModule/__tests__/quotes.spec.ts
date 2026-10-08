import './helpers/clearDatabaseUrl';
import { FULL_WORD_RELATIONS, RELATION_LOAD_STRATEGY } from '../utils/wordRelations';
import { prepareWordFromDB } from '../utils/prepareWordFromDB';
import { toPublicWord } from '../../PublicApiModule/utils/projection';
import { normalizeQuotes } from '../utils/quotes';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddMeaningReqDTO } from '../modules/EnMeaning/dto/AddMeaningReq.dto';
import { WordRowsService } from '../word-rows.service';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { DataSource } from 'typeorm';

import { DICTIONARY_ENTITIES } from '../entities/dictionary-entities';
import { EnChange } from '../entities/en_change.entity';
import { EnEntry } from '../entities/en_entry.entity';
import { EnWord } from '../entities/en_word.entity';
import { EnMeaning } from '../entities/en_meaning.entity';
import { EnMeaningTranslation } from '../entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../entities/en_short_translation.entity';
import { Suggestion } from '../../SuggestionsModule/entities/suggestion.entity';
import { EnService } from '../en.service';
import { EnShortTranslationService } from '../modules/EnShortTranslation/enShortTranslation.service';
import { EnMeaningService } from '../modules/EnMeaning/enMeaning.service';
import { EnMeaningTranslationService } from '../modules/EnMeaningTranslation/enMeaningTranslation.service';
import { EnChangesService } from '../modules/EnChanges/enChanges.service';
import { findWord } from '../utils/changes/words';
import { fullWordSnapshot } from '../utils/changes/snapshots';
import {
  AvailableTranslationLanguagesE,
  EnAreaVariantsE,
  EnPartOfSpeechE,
  EnWordFormsE,
} from '../../../../types';
import { AddWordReqDTO } from '../dto/AddWordReq.dto';

// Quotes are ordered content and survive the same editing and history paths as meanings.
describe('meaning quotations (#577)', () => {
  let ds: DataSource;
  let words: EnService;
  let meanings: EnMeaningService;
  let translations: EnMeaningTranslationService;
  let shorts: EnShortTranslationService;
  let changes: EnChangesService;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [...DICTIONARY_ENTITIES, Suggestion],
      synchronize: true,
    });
    await ds.initialize();

    shorts = new EnShortTranslationService(ds.getRepository(EnWord), ds.getRepository(EnShortTranslation));
    translations = new EnMeaningTranslationService(
      ds.getRepository(EnMeaning),
      ds.getRepository(EnMeaningTranslation),
    );
    meanings = new EnMeaningService(ds.getRepository(EnWord), ds.getRepository(EnMeaning), translations);
    words = new EnService(ds.getRepository(EnWord), ds, shorts, meanings, new WordRowsService(ds));
    changes = new EnChangesService(ds);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await ds.synchronize(true);
  });

  const idOf = (res: object): number => (res as { id: number }).id;
  const history = async (): Promise<EnChange[]> => ds.getRepository(EnChange).find({ order: { id: 'ASC' } });
  const last = async (): Promise<EnChange> => (await history()).at(-1) as EnChange;
  const readWord = async (word: string, pos = 'noun'): Promise<EnWord | null> =>
    findWord(ds.manager, word, pos);

  // an entry as an import leaves it: no history, not kept through updates
  const imported = async (word: string, pos = EnPartOfSpeechE.noun): Promise<EnWord> => {
    const saved = await ds.getRepository(EnEntry).save({ word });
    return ds.getRepository(EnWord).save({
      word: saved,
      part_of_speech: pos,
      form_of_word: EnWordFormsE.base_form,
      description: `the word ${word}`,
      generated: false,
    });
  };

  const lamp = (): AddWordReqDTO =>
    ({
      word: 'lamp',
      part_of_speech: EnPartOfSpeechE.noun,
      form_of_word: EnWordFormsE.base_form,
      description: 'a device that gives light',
      transcription: '/læmp/',
      generated: false,
      forms: [{ word: 'lamps', form_of_word: EnWordFormsE.plural_form, area_variant: EnAreaVariantsE.common }],
      meanings: [
        {
          title: 'a light',
          definition: 'A device that gives light.',
          sort_order: 1,
          is_obsolete: false,
          examples: ['Turn on the lamp.'],
          area_variant: EnAreaVariantsE.common,
          synonyms: ['light'],
          translations: [
            {
              language: AvailableTranslationLanguagesE.ru,
              title: 'лампа',
              definition: 'Устройство, дающее свет.',
              variants_of_words: ['лампа'],
            },
          ],
        },
      ],
      short_translations: [
        { language: AvailableTranslationLanguagesE.ru, description: 'лампа', variants_of_words: ['лампа'] },
      ],
    }) as unknown as AddWordReqDTO;

  const quotes = [
    {
      text: 'An invented quotation. '.repeat(30),
      reference: 'Invented Author, Book, 2026, p. 7',
      source_url: 'https://example.org/book?p=7',
    },
    { text: 'Another quotation.\nWith a second line.', reference: null },
  ];
  const create = async () => {
    await imported('light');
    const body = lamp();
    body.meanings![0].quotes = quotes;
    const id = idOf(await words.addWord(body));
    await ds.getRepository(EnChange).clear();
    return id;
  };

  it('loads complete ordered quotes through raw rows, TypeORM, admin and public projections', async () => {
    const id = await create();
    const [raw] = await new WordRowsService(ds).load([id], FULL_WORD_RELATIONS);
    const entity = await ds.manager.findOneOrFail(EnWord, {
      where: { id },
      relations: FULL_WORD_RELATIONS,
      relationLoadStrategy: RELATION_LOAD_STRATEGY,
    });
    expect(raw.meanings[0].quotes).toEqual(entity.meanings[0].quotes);
    expect(prepareWordFromDB(raw).meanings[0].quotes).toEqual(quotes);
    expect(toPublicWord(raw, { with_meanings: true }).meanings[0].quotes).toEqual(quotes);
    expect(raw.meanings[0].examples).toEqual(['Turn on the lamp.']);
  });

  it('preserves omitted quotes, records replacements in order, and restores clear/delete operations', async () => {
    const id = await create();
    const meaning = (await readWord('lamp'))!.meanings[0];
    await meanings.editMeaning({ id: meaning.id, definition: 'A corrected definition.' });
    expect((await readWord('lamp'))!.meanings[0].quotes).toEqual(quotes);
    await meanings.editMeaning({ id: meaning.id, quotes: [...quotes].reverse() });
    expect((await last()).diff.quotes).toEqual({ before: quotes, after: [...quotes].reverse() });
    await changes.revert((await last()).id);
    expect((await readWord('lamp'))!.meanings[0].quotes).toEqual(quotes);
    await meanings.editMeaning({ id: meaning.id, quotes: [] });
    expect((await readWord('lamp'))!.meanings[0].quotes).toEqual([]);
    await changes.revert((await last()).id);
    const before = fullWordSnapshot((await readWord('lamp'))!);
    await meanings.deleteMeaning(meaning.id);
    await changes.revert((await last()).id);
    expect(fullWordSnapshot((await readWord('lamp'))!)).toEqual(before);
    await words.deleteWord(id);
    await changes.revert((await last()).id);
    expect(fullWordSnapshot((await readWord('lamp'))!)).toEqual(before);
  });

  it('accepts absent attribution without inventing it and validates nested DTOs and imports', async () => {
    expect(normalizeQuotes([{ text: 'A quotation.' }])).toEqual([{ text: 'A quotation.', reference: null }]);
    expect(normalizeQuotes(undefined)).toEqual([]);
    for (const invalid of [
      { text: ' ' },
      { text: 'quote', reference: 5 },
      { text: 'quote', source_url: 'javascript:alert(1)' },
    ]) {
      expect(() => normalizeQuotes([invalid])).toThrow('Invalid quote');
      const body = plainToInstance(AddMeaningReqDTO, {
        word_id: 1,
        title: 'test',
        definition: 'test',
        examples: [],
        sort_order: 1,
        is_obsolete: false,
        translations: [],
        quotes: [invalid],
      });
      expect((await validate(body)).some((error) => error.property === 'quotes')).toBe(true);
    }
  });
});
