import { restoreEtymologies, resolveEtymology } from '../etymologies';
import { alternativeSpellings, replaceAlternatives } from '../entryAlternatives';
import { Dataset } from '../../../DatasetsModule/entities/dataset.entity';
import { defaultOrigins } from '../../../../../core/utils/provenance';
import { currentDatasetName } from '../../../../core/utils/dataset-scope';
import { assertOriginsEdit } from '../../../../core/utils/provenance';
import type { OriginT } from '../../../../../types';
import { ConflictException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { ErrorCodes } from '../../../../../core/constants/error_codes';
import {
  ChangeActionE,
  ChangeDiffT,
  ChangeEntityE,
  ChangeFormRecordT,
  ChangeMeaningRecordT,
  ChangeRecordT,
  ChangeShortTranslationRecordT,
  ChangeTranslationRecordT,
  CustomVersionDictionaryOfWord,
  EnPartOfSpeechE,
  EnWordFormsE,
} from '../../../../../types';
import { EnChange } from '../../entities/en_change.entity';
import { EnEntry } from '../../entities/en_entry.entity';
import { EnMeaning } from '../../entities/en_meaning.entity';
import { EnMeaningTranslation } from '../../entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../../entities/en_short_translation.entity';
import { EnWord } from '../../entities/en_word.entity';
import { findBaseFormHeadwords, loadEntries } from '../findBaseFormHeadwords';
import { deleteWordRows, dropEntryIfUnused, entryTypeOf, findWord, getOrAddEntry } from './words';
import { recordChange } from './recordChange';
import {
  fullWordSnapshot,
  changedFields,
  createdFields,
  deletedFields,
  formRecord,
  formSnapshot,
  meaningRecord,
  meaningSnapshot,
  saysTheSame,
  shortTranslationRecord,
  shortTranslationSnapshot,
  SnapshotT,
  translationRecord,
  translationSnapshot,
  wordSnapshot,
} from './snapshots';

/**
 * Taking one change back (issue #531): the record gets the values it had
 * before the change. A history is undone from its end — a change is taken
 * back only while the record still says what the change left; when it was
 * edited again, the later change goes first. What is written is always a
 * listed column of the record: the rows of a history may come from the file
 * of another instance.
 */

const WORD_COLUMNS = [
  'origins',
  'description',
  'transcription',
  'word_level',
  'area_variant',
  'language_register',
  'categories',
  'is_obsolete',
  'is_abbreviation',
  'pattern',
  'generated',
  'generated_by_model',
  'noun___irregular_plural',
  'noun___uncountable',
  'noun___is_proper',
  'noun___always_plural',
  'verb___is_irregular',
  'verb___transitivity',
  'verb___is_phrasal',
  'verb___phrasal_object_pattern',
] as const;
const FORM_COLUMNS = ['form_of_word', 'transcription', 'area_variant', 'is_obsolete'] as const;
const MEANING_COLUMNS = [
  'title',
  'definition',
  'sort_order',
  'examples',
  'quotes',
  'meaning_level',
  'language_register',
  'area_variant',
  'is_obsolete',
  'categories',
] as const;
const TRANSLATION_COLUMNS = ['language', 'title', 'definition', 'variants_of_words'] as const;
const SHORT_TRANSLATION_COLUMNS = ['language', 'description', 'variants_of_words'] as const;

const outdated = (): never => {
  throw new ConflictException(ErrorCodes.change_outdated);
};

const sideOf = (diff: ChangeDiffT, side: 'before' | 'after'): SnapshotT =>
  Object.fromEntries(Object.entries(diff).map(([field, value]) => [field, value?.[side] ?? null]));

const columnsOf = (values: SnapshotT, columns: readonly string[]): SnapshotT =>
  Object.fromEntries(columns.filter((column) => column in values).map((column) => [column, values[column]]));

const listOf = (value: unknown): SnapshotT[] =>
  Array.isArray(value)
    ? value.filter((item): item is SnapshotT => Boolean(item) && typeof item === 'object')
    : [];

const spellingsOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

// the version is no field of what an entry says: it follows the edits (restoreVersion)
const VERSION = 'version';

/** The record still says what the change left, in every field the change touched */
const assertStillSays = (current: SnapshotT, left: SnapshotT): void => {
  for (const [field, value] of Object.entries(left)) {
    if (field === VERSION) continue;
    if (!saysTheSame(current[field], value, field)) outdated();
  }
};

/** What names the record now: the name it had, with what the change made of it */
const nameAfter = <T extends ChangeRecordT>(record: T, left: SnapshotT): T =>
  Object.fromEntries(Object.entries(record).map(([key, value]) => [key, key in left ? left[key] : value])) as T;

// ------------------------------------------------------------- lookups

const formOf = (word: EnWord, name: ChangeFormRecordT): EnWord | undefined =>
  (word.forms ?? []).find((form) => form.word.word === name.word && form.form_of_word === name.form_of_word);

const meaningOf = (word: EnWord, name: ChangeMeaningRecordT): EnMeaning | undefined =>
  (word.meanings ?? []).find(
    (meaning) => meaning.title === name.title && meaning.sort_order === name.sort_order,
  );

const translationOf = (meaning: EnMeaning, name: ChangeTranslationRecordT): EnMeaningTranslation | undefined =>
  (meaning.translations ?? []).find(
    (translation) => translation.language === name.language && translation.title === name.title,
  );

const shortTranslationOf = (
  word: EnWord,
  name: ChangeShortTranslationRecordT,
): EnShortTranslation | undefined =>
  (word.short_translations ?? []).find(
    (translation) => translation.language === name.language && translation.description === name.description,
  );

/** The headwords of base words among the spellings: a link to a word that is gone is not restored */
const linkedEntries = async (em: EntityManager, headword: string, value: unknown): Promise<EnEntry[]> => {
  const spellings = spellingsOf(value).filter((spelling) => spelling !== headword);
  const known = await findBaseFormHeadwords(em, spellings);
  return loadEntries(
    em,
    spellings.filter((spelling) => known.has(spelling)),
  );
};

const basePhrasalOf = async (em: EntityManager, value: unknown): Promise<EnWord | null> => {
  if (typeof value !== 'string' || value === '') return null;
  return findWord(em, value, EnPartOfSpeechE.verb);
};

/** A restored spelling keeps links of any surviving POS, plus those in its snapshot. */
const restoreAlternatives = async (em: EntityManager, headword: string, value: unknown): Promise<void> => {
  if (!Array.isArray(value)) return;
  const entry = await em.findOneOrFail(EnEntry, {
    where: { word: headword },
    relations: { alternatives: true },
  });
  await replaceAlternatives(em, new Map([[headword, [...alternativeSpellings(entry), ...spellingsOf(value)]]]));
};

// ------------------------------------------------------------ creation

const addForm = async (em: EntityManager, word: EnWord, values: SnapshotT): Promise<EnWord> => {
  const entry = await getOrAddEntry(em, String(values.word), entryTypeOf(EnPartOfSpeechE.noun));
  const saved = await em.getRepository(EnWord).save({
    ...columnsOf(values, FORM_COLUMNS),
    word: entry,
    part_of_speech: word.part_of_speech,
    base_form: word,
    generated: false,
  });
  await restoreAlternatives(em, entry.word, values.alternatives);
  return em.findOneOrFail(EnWord, { where: { id: saved.id }, relations: { word: { alternatives: true } } });
};

const addTranslation = async (
  em: EntityManager,
  meaning: EnMeaning,
  values: SnapshotT,
): Promise<EnMeaningTranslation> =>
  em.getRepository(EnMeaningTranslation).save({ ...columnsOf(values, TRANSLATION_COLUMNS), meaning });

const addMeaning = async (em: EntityManager, word: EnWord, values: SnapshotT): Promise<EnMeaning> => {
  const headword = word.word.word;
  const saved = await em.getRepository(EnMeaning).save({
    ...columnsOf(values, MEANING_COLUMNS),
    ...('etymology_number' in values && {
      etymology: await resolveEtymology(em, word.id, values.etymology_number as number | null),
    }),
    word,
    synonyms: await linkedEntries(em, headword, values.synonyms),
    antonyms: await linkedEntries(em, headword, values.antonyms),
  });
  for (const translation of listOf(values.translations)) await addTranslation(em, saved, translation);
  return em.getRepository(EnMeaning).findOneOrFail({
    where: { id: saved.id },
    relations: { etymology: true, translations: true, synonyms: true, antonyms: true },
  });
};

const addShortTranslation = async (
  em: EntityManager,
  word: EnWord,
  values: SnapshotT,
): Promise<EnShortTranslation> =>
  em.getRepository(EnShortTranslation).save({ ...columnsOf(values, SHORT_TRANSLATION_COLUMNS), word });

const addWord = async (em: EntityManager, change: EnChange, values: SnapshotT): Promise<EnWord> => {
  const partOfSpeech = change.part_of_speech as EnPartOfSpeechE;
  const entry = await getOrAddEntry(em, change.headword, entryTypeOf(partOfSpeech));
  const registry = em.connection.hasMetadata(Dataset)
    ? await em.findOneBy(Dataset, { name: currentDatasetName() })
    : null;
  const saved = await em.getRepository(EnWord).save({
    ...columnsOf(values, WORD_COLUMNS),
    origins: (values.origins as OriginT[] | null | undefined) ?? (registry ? defaultOrigins(registry) : null),
    // the word comes back as the one its dataset had
    ...(isVersion(values[VERSION]) && { version: values[VERSION] }),
    word: entry,
    part_of_speech: partOfSpeech,
    form_of_word: EnWordFormsE.base_form,
    base_phrasal: await basePhrasalOf(em, values.base_phrasal),
  });
  const word = Object.assign(saved, { word: entry });
  await restoreAlternatives(em, entry.word, values.alternatives);
  if ('etymologies' in values) await restoreEtymologies(em, word.id, values.etymologies);
  for (const form of listOf(values.forms)) await addForm(em, word, form);
  for (const meaning of listOf(values.meanings)) await addMeaning(em, word, meaning);
  for (const translation of listOf(values.short_translations)) {
    await addShortTranslation(em, word, translation);
  }
  return (await findWord(em, change.headword, partOfSpeech)) as EnWord;
};

// ------------------------------------------------------------- the version

const isVersion = (value: unknown): value is string =>
  typeof value === 'string' && value !== '' && value.length <= 64;

/**
 * Gives a word the version it had before it was edited, once no change
 * of it shows any more: the entry is what its source says again, and is
 * exported as such. The version is the one the history recorded when the
 * entry became the owner's; an entry edited before the history kept it
 * stays as it is. Answers what was restored.
 */
const restoreVersion = async (
  em: EntityManager,
  change: EnChange,
): Promise<{ before: string; after: string } | null> => {
  const word = await findWord(em, change.headword, change.part_of_speech as string);
  if (!word || word.version !== CustomVersionDictionaryOfWord) return null;
  const rows = await em.getRepository(EnChange).find({
    where: { headword: change.headword, part_of_speech: change.part_of_speech as string },
    order: { id: 'DESC' },
  });
  const recorded = rows
    .map((row) => row.diff?.[VERSION])
    .find((version) => version?.after === CustomVersionDictionaryOfWord && isVersion(version.before));
  if (!recorded) return null;
  const original = recorded.before as string;
  await em.getRepository(EnWord).save({ id: word.id, version: original });
  return { before: CustomVersionDictionaryOfWord, after: original };
};

// ------------------------------------------------------------- the five records

type RevertedT = { action: ChangeActionE; record: ChangeRecordT | null; diff: ChangeDiffT | null };

const created = (record: ChangeRecordT | null, after: SnapshotT): RevertedT => ({
  action: ChangeActionE.create,
  record,
  diff: createdFields(after),
});

const deleted = (record: ChangeRecordT | null, before: SnapshotT): RevertedT => ({
  action: ChangeActionE.delete,
  record,
  diff: deletedFields(before),
});

const updated = (record: ChangeRecordT | null, before: SnapshotT, after: SnapshotT): RevertedT => ({
  action: ChangeActionE.update,
  record,
  diff: changedFields(before, after),
});

const revertWord = async (em: EntityManager, change: EnChange, diff: ChangeDiffT): Promise<RevertedT> => {
  const word = await findWord(em, change.headword, change.part_of_speech as string);

  if (change.action === ChangeActionE.delete) {
    if (word) outdated();
    return created(null, fullWordSnapshot(await addWord(em, change, sideOf(diff, 'before'))));
  }
  if (!word) return outdated();

  if (change.action === ChangeActionE.create) {
    const before = fullWordSnapshot(word);
    const { alternatives: _sharedAlternatives, ...left } = sideOf(diff, 'after');
    assertStillSays(before, left);
    await deleteWordRows(em, word);
    return deleted(null, before);
  }

  const before = wordSnapshot(word);
  assertStillSays(before, sideOf(diff, 'after'));
  const values = sideOf(diff, 'before');
  if ('origins' in values) assertOriginsEdit(word.origins ?? [], values.origins as OriginT[]);
  await em.getRepository(EnWord).save({
    id: word.id,
    ...columnsOf(values, WORD_COLUMNS),
    ...('base_phrasal' in values && { base_phrasal: await basePhrasalOf(em, values.base_phrasal) }),
  });
  if ('etymologies' in values) await restoreEtymologies(em, word.id, values.etymologies);
  const after = (await findWord(em, change.headword, change.part_of_speech as string)) as EnWord;
  return updated(null, before, wordSnapshot(after));
};

const revertForm = async (
  em: EntityManager,
  change: EnChange,
  diff: ChangeDiffT,
  word: EnWord,
): Promise<RevertedT> => {
  const name = change.record as ChangeFormRecordT;

  if (change.action === ChangeActionE.delete) {
    if (formOf(word, name)) outdated();
    const form = await addForm(em, word, sideOf(diff, 'before'));
    return created(formRecord(form), formSnapshot(form));
  }
  const left = sideOf(diff, 'after');
  const form = formOf(word, nameAfter(name, left));
  if (!form) return outdated();
  const before = formSnapshot(form);
  const record = formRecord(form);
  const { alternatives: _sharedAlternatives, ...leftForm } = left;
  assertStillSays(before, leftForm);

  if (change.action === ChangeActionE.create) {
    await em.getRepository(EnWord).delete({ id: form.id });
    await dropEntryIfUnused(em, form.word.word);
    return deleted(record, before);
  }

  const values = sideOf(diff, 'before');
  const spelling = typeof values.word === 'string' && values.word !== '' ? values.word : form.word.word;
  const entry = await getOrAddEntry(em, spelling, entryTypeOf(EnPartOfSpeechE.noun));
  await em.getRepository(EnWord).save({ id: form.id, ...columnsOf(values, FORM_COLUMNS), word: entry });
  if (spelling !== form.word.word) {
    await dropEntryIfUnused(em, form.word.word);
    await restoreAlternatives(em, spelling, values.alternatives);
  }
  const after = await em
    .getRepository(EnWord)
    .findOneOrFail({ where: { id: form.id }, relations: { word: { alternatives: true } } });
  return updated(record, before, formSnapshot(after));
};

const MEANING_RELATIONS = { etymology: true, translations: true, synonyms: true, antonyms: true } as const;

const revertMeaning = async (
  em: EntityManager,
  change: EnChange,
  diff: ChangeDiffT,
  word: EnWord,
): Promise<RevertedT> => {
  const name = change.record as ChangeMeaningRecordT;

  if (change.action === ChangeActionE.delete) {
    if (meaningOf(word, name)) outdated();
    const meaning = await addMeaning(em, word, sideOf(diff, 'before'));
    return created(meaningRecord(meaning), meaningSnapshot(meaning, true));
  }
  const left = sideOf(diff, 'after');
  const meaning = meaningOf(word, nameAfter(name, left));
  if (!meaning) return outdated();
  const record = meaningRecord(meaning);

  if (change.action === ChangeActionE.create) {
    const before = meaningSnapshot(meaning, true);
    assertStillSays(before, left);
    await em.getRepository(EnMeaning).delete({ id: meaning.id });
    return deleted(record, before);
  }

  const before = meaningSnapshot(meaning);
  assertStillSays(before, left);
  const values = sideOf(diff, 'before');
  const headword = word.word.word;
  await em.getRepository(EnMeaning).save({
    id: meaning.id,
    ...columnsOf(values, MEANING_COLUMNS),
    ...('etymology_number' in values && {
      etymology: await resolveEtymology(em, word.id, values.etymology_number as number | null),
    }),
    ...('synonyms' in values && { synonyms: await linkedEntries(em, headword, values.synonyms) }),
    ...('antonyms' in values && { antonyms: await linkedEntries(em, headword, values.antonyms) }),
  });
  const after = await em
    .getRepository(EnMeaning)
    .findOneOrFail({ where: { id: meaning.id }, relations: MEANING_RELATIONS });
  return updated(record, before, meaningSnapshot(after));
};

const revertTranslation = async (
  em: EntityManager,
  change: EnChange,
  diff: ChangeDiffT,
  word: EnWord,
): Promise<RevertedT> => {
  const name = change.record as ChangeTranslationRecordT;
  const meaning = meaningOf(word, name.meaning);
  if (!meaning) return outdated();

  if (change.action === ChangeActionE.delete) {
    if (translationOf(meaning, name)) outdated();
    const translation = await addTranslation(em, meaning, sideOf(diff, 'before'));
    return created(translationRecord(translation, meaning), translationSnapshot(translation));
  }
  const left = sideOf(diff, 'after');
  const translation = translationOf(meaning, { ...nameAfter(name, left), meaning: name.meaning });
  if (!translation) return outdated();
  const before = translationSnapshot(translation);
  const record = translationRecord(translation, meaning);
  assertStillSays(before, left);

  const translations = em.getRepository(EnMeaningTranslation);
  if (change.action === ChangeActionE.create) {
    await translations.delete({ id: translation.id });
    return deleted(record, before);
  }
  await translations.save({ id: translation.id, ...columnsOf(sideOf(diff, 'before'), TRANSLATION_COLUMNS) });
  return updated(
    record,
    before,
    translationSnapshot(await translations.findOneOrFail({ where: { id: translation.id } })),
  );
};

const revertShortTranslation = async (
  em: EntityManager,
  change: EnChange,
  diff: ChangeDiffT,
  word: EnWord,
): Promise<RevertedT> => {
  const name = change.record as ChangeShortTranslationRecordT;

  if (change.action === ChangeActionE.delete) {
    if (shortTranslationOf(word, name)) outdated();
    const translation = await addShortTranslation(em, word, sideOf(diff, 'before'));
    return created(shortTranslationRecord(translation), shortTranslationSnapshot(translation));
  }
  const left = sideOf(diff, 'after');
  const translation = shortTranslationOf(word, nameAfter(name, left));
  if (!translation) return outdated();
  const before = shortTranslationSnapshot(translation);
  const record = shortTranslationRecord(translation);
  assertStillSays(before, left);

  const translations = em.getRepository(EnShortTranslation);
  if (change.action === ChangeActionE.create) {
    await translations.delete({ id: translation.id });
    return deleted(record, before);
  }
  await translations.save({
    id: translation.id,
    ...columnsOf(sideOf(diff, 'before'), SHORT_TRANSLATION_COLUMNS),
  });
  return updated(
    record,
    before,
    shortTranslationSnapshot(await translations.findOneOrFail({ where: { id: translation.id } })),
  );
};

const revertRecord = async (em: EntityManager, change: EnChange, diff: ChangeDiffT): Promise<RevertedT> => {
  if (change.entity === ChangeEntityE.word && change.part_of_speech === null) {
    if (change.action !== ChangeActionE.update || Object.keys(diff).some((key) => key !== 'alternatives'))
      return outdated();
    const entry = await em.findOne(EnEntry, {
      where: { word: change.headword },
      relations: { alternatives: true },
    });
    if (!entry) return outdated();
    const before = { alternatives: alternativeSpellings(entry) };
    assertStillSays(before, sideOf(diff, 'after'));
    const restored = spellingsOf(sideOf(diff, 'before').alternatives);
    const peers = new Map<string, string[]>();
    for (const name of new Set([...before.alternatives, ...restored])) {
      const peer = await em.findOne(EnEntry, { where: { word: name }, relations: { alternatives: true } });
      if (peer) peers.set(name, alternativeSpellings(peer));
    }
    await replaceAlternatives(em, new Map([[entry.word, restored]]));
    // Reverting either endpoint also undoes the reciprocal history record.
    for (const [headword, previous] of peers) {
      const peer = await em.findOneOrFail(EnEntry, {
        where: { word: headword },
        relations: { alternatives: true },
      });
      const current = alternativeSpellings(peer);
      const peerDiff = changedFields({ alternatives: previous }, { alternatives: current });
      if (!peerDiff) continue;
      const active = await em.find(EnChange, {
        where: { headword, part_of_speech: IsNull(), superseded_at: IsNull() },
        order: { id: 'DESC' },
      });
      const inverse = active.find(
        (item) =>
          !item.inherited_from &&
          item.entity === ChangeEntityE.word &&
          item.action === ChangeActionE.update &&
          Object.keys(item.diff).length === 1 &&
          saysTheSame(item.diff.alternatives?.after, previous) &&
          saysTheSame(item.diff.alternatives?.before, current),
      );
      await recordChange(em, {
        headword,
        part_of_speech: null,
        entity: ChangeEntityE.word,
        action: ChangeActionE.update,
        diff: peerDiff,
      });
      if (inverse) await em.update(EnChange, { id: inverse.id }, { superseded_at: new Date() });
      if (!(await em.count(EnChange, { where: { headword, superseded_at: IsNull() } })))
        await em.update(EnEntry, { word: headword }, { user_modified: false });
    }
    const after = await em.findOneOrFail(EnEntry, {
      where: { word: entry.word },
      relations: { alternatives: true },
    });
    return updated(null, before, { alternatives: alternativeSpellings(after) });
  }
  if (change.entity === ChangeEntityE.word) return revertWord(em, change, diff);
  if (!change.record) return outdated();
  const word = await findWord(em, change.headword, change.part_of_speech as string);
  if (!word) return outdated();
  switch (change.entity) {
    case ChangeEntityE.word_form:
      return revertForm(em, change, diff, word);
    case ChangeEntityE.meaning:
      return revertMeaning(em, change, diff, word);
    case ChangeEntityE.meaning_translation:
      return revertTranslation(em, change, diff, word);
    case ChangeEntityE.short_translation:
      return revertShortTranslation(em, change, diff, word);
    default:
      throw new ConflictException(ErrorCodes.change_not_revertible);
  }
};

/** Whether a change can be taken back at all: it still shows in what is served, and names its word */
export const isRevertible = (change: EnChange): boolean =>
  !change.inherited_from &&
  !change.superseded_at &&
  (Boolean(change.part_of_speech) ||
    (change.entity === ChangeEntityE.word &&
      change.action === ChangeActionE.update &&
      Object.keys(change.diff).length === 1 &&
      'alternatives' in change.diff));

/**
 * Takes a change back, with the manager of one transaction and inside
 * `withChangeSource({ origin: revert, superseded: true })`: the record is
 * restored, the history gets a row that says what was restored, the change
 * stops showing. An entry with no change left is what its source says
 * again, and an update of the dataset may replace it.
 */
export const revertChange = async (em: EntityManager, change: EnChange): Promise<void> => {
  if (!isRevertible(change)) throw new ConflictException(ErrorCodes.change_not_revertible);
  const changes = em.getRepository(EnChange);
  const word = { headword: change.headword, part_of_speech: change.part_of_speech };
  const reverted = await revertRecord(em, change, change.diff);

  // the last change of the entry that shows: the entry gets its version back
  const shown = await changes.count({
    where: { ...word, part_of_speech: word.part_of_speech ?? IsNull(), superseded_at: IsNull() },
  });
  const version = change.part_of_speech && shown <= 1 ? await restoreVersion(em, change) : null;
  const diff =
    version && change.entity === ChangeEntityE.word && reverted.action === ChangeActionE.update
      ? { ...reverted.diff, [VERSION]: version }
      : reverted.diff;

  await recordChange(em, { ...word, entity: change.entity, ...reverted, diff });
  await changes.update({ id: change.id }, { superseded_at: new Date() });
  const left = await changes.count({ where: { headword: change.headword, superseded_at: IsNull() } });
  if (left === 0) await em.getRepository(EnEntry).update({ word: change.headword }, { user_modified: false });
};
