import {
  EnMeaningListItemT,
  EnMeaningTranslationListItemT,
  EnShortTranslationListItemT,
  ErrorResT,
  PaginatedListT,
} from 'server/types';
import { EnApi } from '@/core/api/EnApi';
import { BulkItemT, RunIdentityT, SourceKindE, SourceStateT } from './types';
import { TemplateVarsT } from './utils/renderTemplate';

export const SOURCE_KINDS = [
  SourceKindE.words,
  SourceKindE.meanings,
  SourceKindE.translations,
  SourceKindE.short_translations,
] as const;

/**
 * Placeholders available in the prompt template per source table: the word
 * identity (word, part of speech) plus the columns of the table itself. The
 * body template additionally gets {{prompt}}.
 */
export const SOURCE_PLACEHOLDERS: Record<SourceKindE, readonly string[]> = {
  [SourceKindE.words]: [
    'word',
    'part_of_speech',
    'area_variant',
    'word_level',
    'language_register',
    'generated_by_model',
    'version',
    'transcription',
    'description',
    'categories',
  ],
  [SourceKindE.meanings]: [
    'word',
    'part_of_speech',
    'title',
    'definition',
    'examples',
    'synonyms',
    'antonyms',
    'area_variant',
    'meaning_level',
    'language_register',
    'categories',
    'sort_order',
    'is_obsolete',
  ],
  [SourceKindE.translations]: [
    'word',
    'part_of_speech',
    'language',
    'title',
    'definition',
    'variants_of_words',
    'meaning_title',
    'meaning_definition',
  ],
  [SourceKindE.short_translations]: ['word', 'part_of_speech', 'language', 'description', 'variants_of_words'],
};

export const emptySource = (kind: SourceKindE): SourceStateT => ({ kind, filter: {} });

/**
 * Lists one page of the chosen table through our own API: a numbered page
 * for the table, or the page after the row `after` (its id, from the
 * previous answer's next_after) for a walk over every row — a keyset page
 * the server reads without an OFFSET, whatever the depth
 */
export const listRecords = (
  source: SourceStateT,
  page: number,
  limit: number,
  after?: number,
): Promise<PaginatedListT<BulkItemT> | ErrorResT> => {
  const pagination = { page, limit, ...(after !== undefined && { after }) };
  switch (source.kind) {
    case SourceKindE.words:
      return EnApi.listWords({ ...source.filter, ...pagination });
    case SourceKindE.meanings:
      return EnApi.listMeanings({ ...source.filter, ...pagination });
    case SourceKindE.translations:
      return EnApi.listMeaningTranslations({ ...source.filter, ...pagination });
    case SourceKindE.short_translations:
      return EnApi.listShortTranslations({ ...source.filter, ...pagination });
  }
};

/** The template variables of one row: exactly the placeholders of its table */
export const toTemplateVars = (kind: SourceKindE, item: BulkItemT): TemplateVarsT => {
  const record = item as unknown as Record<string, unknown>;
  return Object.fromEntries(SOURCE_PLACEHOLDERS[kind].map((name) => [name, record[name] ?? '']));
};

/** The fields that open every output line so a line can be traced back to its row */
export const toIdentity = (kind: SourceKindE, item: BulkItemT): RunIdentityT => {
  const base = { word: item.word, part_of_speech: item.part_of_speech };
  switch (kind) {
    case SourceKindE.words:
      return base;
    // a meaning is named the way the dataset files name it (issue #442): by
    // its sort order and title within the word, so a line of translations
    // loads as a line of vocab-bloom-hub-en-meaning-translations.jsonl
    case SourceKindE.meanings: {
      const meaning = item as EnMeaningListItemT;
      return {
        ...base,
        meaning_id: meaning.id,
        meaning_sort_order: meaning.sort_order,
        meaning_title: meaning.title,
      };
    }
    case SourceKindE.translations: {
      const translation = item as EnMeaningTranslationListItemT;
      return {
        ...base,
        meaning_id: translation.meaning_id,
        meaning_sort_order: translation.meaning_sort_order,
        meaning_title: translation.meaning_title,
        translation_id: translation.id,
        language: translation.language,
      };
    }
    case SourceKindE.short_translations: {
      const shortTranslation = item as EnShortTranslationListItemT;
      return {
        ...base,
        short_translation_id: shortTranslation.id,
        language: shortTranslation.language,
      };
    }
  }
};

/** Short human-readable name of a row for the failures table */
export const toLabel = (kind: SourceKindE, item: BulkItemT): string => {
  if (kind === SourceKindE.words) return item.word;
  if (kind === SourceKindE.short_translations) return (item as EnShortTranslationListItemT).description;
  return 'title' in item ? item.title : item.word;
};

/** How many filter fields are set: shown on the collapsed filters panel */
export const countActiveFilters = (source: SourceStateT): number =>
  Object.values(source.filter).filter((v) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length))
    .length;
