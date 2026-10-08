import './helpers/clearDatabaseUrl';
import { FULL_WORD_RELATIONS, RELATION_LOAD_STRATEGY } from '../utils/wordRelations';
import { prepareWordFromDB } from '../utils/prepareWordFromDB';
import { toPublicWord } from '../../PublicApiModule/utils/projection';
import { EnPronunciation } from '../entities/en_pronunciation.entity';
import { orderedPronunciations, primaryIPA, pronunciationsOf } from '../utils/pronunciations';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EditCommonInfoOfWordReqDTO } from '../dto/EditCommonInfoOfWordReq.dto';
import { jest } from '@jest/globals';
import type { PronunciationT } from '../../../../types';
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

// The lists belong to word rows, including forms; their snapshots contain no database IDs.
describe('word pronunciations (#578)', () => {
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

  const sounds: PronunciationT[] = [
    { type: 'ipa', text: '/test-uk/', area_variant: EnAreaVariantsE.british, sort_order: 0 },
    { type: 'ipa', text: '/test-us/', area_variant: EnAreaVariantsE.american, sort_order: 1 },
    { type: 'ipa', text: '/test-us-2/', area_variant: EnAreaVariantsE.american, sort_order: 2 },
    { type: 'enpr', text: 'test', area_variant: EnAreaVariantsE.common, sort_order: 3 },
  ];
  const formSounds: PronunciationT[] = [{ ...sounds[0], text: '/tests/' }];
  const create = async () => {
    await imported('light');
    const body = lamp();
    body.pronunciations = [...sounds].reverse();
    body.transcription = '';
    body.forms![0].pronunciations = formSounds;
    body.forms![0].transcription = '/legacy-form/';
    const id = idOf(await words.addWord(body));
    await ds.getRepository(EnChange).clear();
    return id;
  };

  it('keeps all variants, orders deterministically and preserves the form transcription', async () => {
    const id = await create();
    const loader = new WordRowsService(ds);
    const [raw] = await loader.load([id], FULL_WORD_RELATIONS);
    const entity = await ds.manager.findOneOrFail(EnWord, {
      where: { id },
      relations: FULL_WORD_RELATIONS,
      relationLoadStrategy: RELATION_LOAD_STRATEGY,
    });
    const normalize = (word: EnWord) => ({
      ...fullWordSnapshot(word),
      base_form: word.base_form
        ? { ...word.base_form, pronunciations: orderedPronunciations(word.base_form.pronunciations ?? []) }
        : null,
    });
    expect(normalize(raw)).toEqual(normalize(entity));
    expect(raw.transcription).toBe('/test-us/');
    expect(raw.forms[0].transcription).toBe('/legacy-form/');
    expect(prepareWordFromDB(raw).pronunciations?.map(({ id: _id, ...value }) => value)).toEqual(sounds);
    expect(toPublicWord(raw).pronunciations).toEqual(sounds);
    expect(toPublicWord(raw).forms[0].pronunciations).toEqual(formSounds);
    const [form] = await loader.load([raw.forms[0].id], FULL_WORD_RELATIONS);
    expect(toPublicWord(form).pronunciations).toEqual(formSounds);
    const formEntity = await ds.manager.findOneOrFail(EnWord, {
      where: { id: form.id },
      relations: FULL_WORD_RELATIONS,
      relationLoadStrategy: RELATION_LOAD_STRATEGY,
    });
    expect(JSON.parse(JSON.stringify(normalize(form)))).toEqual(
      JSON.parse(JSON.stringify(normalize({ ...formEntity, origins: formEntity.base_form?.origins }))),
    );
    const queries = jest.spyOn(ds.logger, 'logQuery');
    await loader.load([id, form.id], FULL_WORD_RELATIONS);
    expect(queries.mock.calls.filter(([sql]) => sql.includes('FROM "en_pronunciations"'))).toHaveLength(1);
    queries.mockRestore();
  });

  it('falls back to legacy then base only for public reads, without storing copies or edits', async () => {
    const id = await create();
    const word = (await readWord('lamp'))!;
    const formId = word.forms[0].id;
    await ds.manager.delete(EnPronunciation, { word: { id: formId } });
    let [raw] = await new WordRowsService(ds).load([formId], FULL_WORD_RELATIONS);
    expect(toPublicWord(raw).pronunciations?.[0].text).toBe('/legacy-form/');
    await ds.manager.update(EnWord, formId, { transcription: '' });
    [raw] = await new WordRowsService(ds).load([formId], FULL_WORD_RELATIONS);
    expect(toPublicWord(raw).pronunciations).toEqual(sounds);
    expect(prepareWordFromDB(raw).pronunciations).toEqual([]);
    expect(await ds.manager.count(EnPronunciation)).toBe(4);
    expect(await history()).toEqual([]);
    const [base] = await new WordRowsService(ds).load([id], FULL_WORD_RELATIONS);
    expect(toPublicWord(base).forms[0].pronunciations).toEqual(sounds);
    expect(primaryIPA([sounds[3]])).toBe('');
    expect(
      pronunciationsOf({
        ...base,
        transcription: '',
        pronunciations: [{ ...base.pronunciations![0], text: null }],
      }),
    ).toEqual([]);
  });

  it('reverts list edits, clears, form deletion and word deletion through portable snapshots', async () => {
    const id = await create();
    const before = fullWordSnapshot((await readWord('lamp'))!);
    await words.editWord(id, { description: 'Changed description.' });
    expect((await readWord('lamp'))!.pronunciations).toHaveLength(4);
    await changes.revert((await last()).id);
    const own = (await readWord('lamp'))!.pronunciations![0];
    await words.editWord(id, { pronunciations: [{ ...own, text: '/changed/' }] });
    const changed = (await readWord('lamp'))!.pronunciations!;
    expect(changed).toHaveLength(1);
    expect(changed[0].id).toBe(own.id);
    await changes.revert((await last()).id);
    expect(fullWordSnapshot((await readWord('lamp'))!)).toEqual(before);
    await words.editWord(id, { pronunciations: [] });
    expect((await readWord('lamp'))!.pronunciations).toEqual([]);
    await changes.revert((await last()).id);
    const form = (await readWord('lamp'))!.forms[0];
    await words.editWordForm({ id: form.id, pronunciations: [{ ...formSounds[0], text: '/changed-form/' }] });
    expect((await readWord('lamp'))!.forms[0].transcription).toBe('/changed-form/');
    await changes.revert((await last()).id);
    expect(fullWordSnapshot((await readWord('lamp'))!)).toEqual(before);
    await words.deleteWord(form.id);
    await changes.revert((await last()).id);
    expect(fullWordSnapshot((await readWord('lamp'))!)).toEqual(before);
    await words.deleteWord(id);
    expect(await ds.manager.count(EnPronunciation)).toBe(0);
    await changes.revert((await last()).id);
    expect(fullWordSnapshot((await readWord('lamp'))!)).toEqual(before);
    expect(JSON.stringify((await last()).diff)).not.toContain('"word":{"id"');
  });

  it('rejects foreign IDs, invalid types, regions, orders and empty text atomically', async () => {
    const id = await create();
    const foreign = await imported('other');
    const own = (await readWord('lamp'))!.pronunciations![0];
    await expect(words.editWord(foreign.id, { pronunciations: [own] })).rejects.toThrow('does not belong');
    for (const value of [
      { ...sounds[0], text: null },
      { ...sounds[0], text: ' ' },
      { ...sounds[0], sort_order: -1 },
      { ...sounds[0], type: 'unknown' },
      { ...sounds[0], area_variant: 'moon' },
    ]) {
      const dto = plainToInstance(EditCommonInfoOfWordReqDTO, { pronunciations: [value] });
      expect((await validate(dto)).length).toBeGreaterThan(0);
      await expect(words.editWord(id, dto)).rejects.toThrow('Invalid pronunciation');
    }
    expect((await readWord('lamp'))!.pronunciations).toHaveLength(4);
    expect(await history()).toEqual([]);
  });
});
