import { BadRequestException } from '@nestjs/common';
import { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import { EnPartOfSpeechE, EnWordFormsE, OriginT } from '../../../../../types';
import type { ReconciliationValueT } from '../../../../../types/reconciliation';
import { assertCompatibleOrigins, assertOrigins } from '../../../../core/utils/provenance';
import { EnWord } from '../../entities/en_word.entity';
import { EnMeaning } from '../../entities/en_meaning.entity';
import { EnMeaningTranslation } from '../../entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../../entities/en_short_translation.entity';
import { EnEtymology } from '../../entities/en_etymology.entity';
import { EnPronunciation } from '../../entities/en_pronunciation.entity';
import { EnPronunciationAudio } from '../../entities/en_pronunciation_audio.entity';
import { validateEtymologies } from '../../utils/etymologies';
import { validatePronunciations } from '../../utils/pronunciations';
import { normalizeQuotes } from '../../utils/quotes';

export type DocumentObjectT = { [key: string]: ReconciliationValueT };
const invalid = (): never => {
  throw new BadRequestException('reconciliation_result_invalid');
};
export const object = (value: ReconciliationValueT | undefined): DocumentObjectT =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value : invalid();
export const strings = (value: ReconciliationValueT | undefined): string[] =>
  Array.isArray(value) && value.every((item): item is string => typeof item === 'string') ? value : invalid();
export const collection = (value: ReconciliationValueT | undefined): [string, DocumentObjectT][] =>
  Object.entries(object(value)).map(([id, row]) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) invalid();
    return [id, object(row)];
  });

/** Only explicit content fields may be edited; no IDs, timestamps or ownership columns. */
export const CONTENT_FIELDS = {
  word: [
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
  ],
  meaning: [
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
  ],
  translation: ['language', 'title', 'definition', 'variants_of_words'],
  short: ['language', 'description', 'variants_of_words'],
  form: ['form_of_word', 'transcription', 'area_variant', 'is_obsolete'],
  etymology: ['number', 'text'],
  pronunciation: ['type', 'text', 'area_variant', 'sort_order'],
  audio: ['url', 'source_url', 'attribution', 'licenses', 'sort_order'],
} as const;

export const fields = (row: DocumentObjectT, allowed: readonly string[]): ObjectLiteral =>
  Object.fromEntries(allowed.filter((field) => Object.hasOwn(row, field)).map((field) => [field, row[field]]));

const validateColumns = (
  em: EntityManager,
  entity: EntityTarget<ObjectLiteral>,
  row: DocumentObjectT,
  allowed: readonly string[],
  relations: string[] = [],
) => {
  if (Object.keys(row).some((key) => !allowed.includes(key) && !relations.includes(key))) invalid();
  const metadata = em.connection.getMetadata(entity);
  for (const name of allowed) {
    const col = metadata.findColumnWithPropertyName(name)!;
    const value = row[name];
    if (value === undefined) {
      if (!col.isNullable && col.default === undefined) invalid();
      continue;
    }
    if (value === null) {
      if (!col.isNullable) invalid();
      continue;
    }
    if (col.isArray || col.type === 'simple-array') {
      if (
        !Array.isArray(value) ||
        value.some((item) => typeof item !== 'string' || (col.enum && !col.enum.includes(item)))
      )
        invalid();
    } else if (col.enum) {
      if (!col.enum.includes(value as string)) invalid();
    } else if (col.type === 'boolean') {
      if (typeof value !== 'boolean') invalid();
    } else if (col.type === 'int') {
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 2147483647)
        invalid();
    } else if (col.type !== 'simple-json' && col.type !== 'jsonb') {
      if (typeof value !== 'string' || (col.length && value.length > Number(col.length))) invalid();
    }
  }
};

export function validateDocument(
  em: EntityManager,
  content: ReconciliationValueT,
  license: string,
  allowGenerated: boolean,
): void {
  const article = object(content);
  if (Object.keys(article).some((field) => !['alternatives', 'parts'].includes(field))) invalid();
  const references = (value: ReconciliationValueT | undefined) => {
    const values = strings(value);
    if (values.some((value) => !value.trim() || value.length > 128) || new Set(values).size !== values.length)
      invalid();
    return values;
  };
  references(article.alternatives);
  const parts = object(article.parts);
  if (!Object.keys(parts).length) invalid();
  const used = new Set<string>();
  const records = (value: ReconciliationValueT | undefined) =>
    collection(value).map(([id, row]) => {
      if (used.has(id)) invalid();
      used.add(id);
      return row;
    });
  const checkPronunciations = (value: ReconciliationValueT | undefined) => {
    const values = records(value).map((row) => {
      validateColumns(em, EnPronunciation, row, CONTENT_FIELDS.pronunciation, ['audio']);
      const audio = records(row.audio);
      for (const item of audio) validateColumns(em, EnPronunciationAudio, item, CONTENT_FIELDS.audio);
      return { ...row, audio };
    });
    validatePronunciations(values as never);
  };
  for (const [part, raw] of Object.entries(parts)) {
    if (!(Object.values(EnPartOfSpeechE) as string[]).includes(part)) invalid();
    const word = object(raw);
    if (
      Object.keys(word).some(
        (key) =>
          !['common', 'pronunciations', 'etymologies', 'forms', 'meanings', 'short_translations'].includes(key),
      )
    )
      invalid();
    const common = object(word.common);
    validateColumns(em, EnWord, common, CONTENT_FIELDS.word, ['base_phrasal']);
    if (common.base_phrasal !== null && typeof common.base_phrasal !== 'string') invalid();
    if (!allowGenerated && common.generated) invalid();
    if (common.origins !== null) {
      assertOrigins(common.origins);
      assertCompatibleOrigins(common.origins as unknown as OriginT[], license);
    }
    checkPronunciations(word.pronunciations);
    const etymologies = records(word.etymologies);
    for (const row of etymologies) validateColumns(em, EnEtymology, row, CONTENT_FIELDS.etymology);
    validateEtymologies(etymologies as never);
    const formKeys = new Set<string>();
    for (const row of records(word.forms)) {
      validateColumns(em, EnWord, row, CONTENT_FIELDS.form, ['word', 'alternatives', 'pronunciations']);
      if (
        typeof row.word !== 'string' ||
        !row.word.trim() ||
        row.word.length > 128 ||
        row.form_of_word === EnWordFormsE.base_form
      )
        invalid();
      const formKey = `${row.word}:${row.form_of_word}`;
      if (formKeys.has(formKey)) invalid();
      formKeys.add(formKey);
      if (row.alternatives !== undefined) references(row.alternatives);
      checkPronunciations(row.pronunciations);
    }
    const meaningKeys = new Set<string>();
    for (const row of records(word.meanings)) {
      validateColumns(em, EnMeaning, row, CONTENT_FIELDS.meaning, [
        'synonyms',
        'antonyms',
        'translations',
        'etymology_number',
      ]);
      const meaningKey = JSON.stringify([row.title, row.sort_order]);
      if (meaningKeys.has(meaningKey)) invalid();
      meaningKeys.add(meaningKey);
      if (row.quotes !== undefined) normalizeQuotes(row.quotes as never);
      if (row.etymology_number != null && !etymologies.some((item) => item.number === row.etymology_number))
        invalid();
      const synonyms = references(row.synonyms);
      const antonyms = references(row.antonyms);
      if (synonyms.some((target) => antonyms.includes(target))) invalid();
      for (const translation of records(row.translations))
        validateColumns(em, EnMeaningTranslation, translation, CONTENT_FIELDS.translation);
    }
    for (const row of records(word.short_translations))
      validateColumns(em, EnShortTranslation, row, CONTENT_FIELDS.short);
  }
}
