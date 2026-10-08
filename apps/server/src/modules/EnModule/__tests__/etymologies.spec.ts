import './helpers/clearDatabaseUrl';
import { FULL_WORD_RELATIONS, RELATION_LOAD_STRATEGY } from '../utils/wordRelations';
import { prepareWordFromDB } from '../utils/prepareWordFromDB';
import { toPublicWord } from '../../PublicApiModule/utils/projection';
import { EnEtymology } from '../entities/en_etymology.entity';
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

// Local etymology numbers stay portable while database IDs protect live associations.
describe('word etymologies (#576)', () => {
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

  const create = async () => {
    await imported('light');
    const body = lamp();
    body.etymologies = [
      { number: 1, text: 'From an invented root.' },
      { number: 2, text: 'From a different root.' },
    ];
    body.meanings = [1, 2, 2].map((number, index) => ({
      ...body.meanings![0],
      etymology_number: number,
      sort_order: index + 1,
    }));
    const id = idOf(await words.addWord(body));
    await ds.getRepository(EnChange).clear();
    return id;
  };

  it('keeps duplicate definitions in distinct etymologies and projects the same raw rows as TypeORM', async () => {
    const id = await create();
    const [raw] = await new WordRowsService(ds).load([id], FULL_WORD_RELATIONS);
    const entity = await ds.manager.findOneOrFail(EnWord, {
      where: { id },
      relations: FULL_WORD_RELATIONS,
      relationLoadStrategy: RELATION_LOAD_STRATEGY,
    });
    const strip = (value: EnWord) => {
      const { contributions: _contributions, ...rest } = value;
      return JSON.parse(JSON.stringify(rest));
    };
    expect(strip(raw)).toEqual(strip(entity));
    expect(prepareWordFromDB(raw).meanings.map((m) => m.etymology_number)).toEqual([1, 2, 2]);
    const publicWord = toPublicWord(raw, { with_meanings: true });
    expect(publicWord.etymologies).toEqual([
      { number: 1, text: 'From an invented root.' },
      { number: 2, text: 'From a different root.' },
    ]);
    expect(publicWord.meanings).toHaveLength(3);
    expect(publicWord.etymologies![0]).not.toHaveProperty('id');
  });

  it('renumbers by ID, detaches deleted groups, and restores their portable history associations', async () => {
    const id = await create();
    const before = fullWordSnapshot((await readWord('lamp'))!);
    const groups = (await readWord('lamp'))!.etymologies!;
    const first = groups.find((item) => item.number === 1)!;
    const second = groups.find((item) => item.number === 2)!;
    await words.editWord(id, {
      etymologies: [
        { id: first.id, number: 2, text: first.text },
        { id: second.id, number: 1, text: second.text },
      ],
    });
    expect((await readWord('lamp'))!.meanings.map((m) => m.etymology?.number)).toEqual([2, 1, 1]);
    await changes.revert((await last()).id);
    expect(fullWordSnapshot((await readWord('lamp'))!)).toEqual(before);
    await words.editWord(id, { etymologies: [] });
    expect((await readWord('lamp'))!.meanings.every((m) => m.etymology === null)).toBe(true);
    await changes.revert((await last()).id);
    expect(fullWordSnapshot((await readWord('lamp'))!)).toEqual(before);
    await words.editWord(id, { etymologies: [{ number: 1, text: 'A replacement group.' }] });
    expect((await readWord('lamp'))!.meanings.every((m) => m.etymology === null)).toBe(true);
    await changes.revert((await last()).id);
    expect(fullWordSnapshot((await readWord('lamp'))!)).toEqual(before);
    await words.deleteWord(id);
    expect(await ds.manager.count(EnEtymology)).toBe(0);
    await changes.revert((await last()).id);
    expect(fullWordSnapshot((await readWord('lamp'))!)).toEqual(before);
  });

  it('rejects cross-word IDs and unknown meaning numbers; changing or clearing a meaning can be reverted', async () => {
    const id = await create();
    const foreign = await imported('other');
    const own = (await readWord('lamp'))!.etymologies![0];
    await expect(
      words.editWord(foreign.id, { etymologies: [{ id: own.id, number: 1, text: own.text }] }),
    ).rejects.toThrow('does not belong');
    await expect(
      words.editWord(id, {
        etymologies: [
          { number: 1, text: 'a' },
          { number: 1, text: 'b' },
        ],
      }),
    ).rejects.toThrow('unique');
    const meaning = (await readWord('lamp'))!.meanings[0];
    await expect(meanings.editMeaning({ id: meaning.id, etymology_number: 42 })).rejects.toThrow(
      'does not belong',
    );
    await meanings.editMeaning({ id: meaning.id, etymology_number: null });
    expect((await readWord('lamp'))!.meanings[0].etymology).toBeNull();
    await changes.revert((await last()).id);
    expect((await readWord('lamp'))!.meanings[0].etymology?.number).toBe(1);
    await meanings.deleteMeaning(meaning.id);
    await changes.revert((await last()).id);
    expect((await readWord('lamp'))!.meanings.find((m) => m.sort_order === 1)!.etymology?.number).toBe(1);
  });
});
