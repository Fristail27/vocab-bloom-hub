import { EnMeaningTranslationListItemT, ErrorResT, PaginatedListT } from 'server/types';
import { EnApi } from '@/core/api/EnApi';
import { BulkItemT, RunIdentityT, SourceKindE, SourceStateT } from './types';
import { TemplateVarsT } from './utils/renderTemplate';

export const SOURCE_KINDS = [SourceKindE.words, SourceKindE.meanings, SourceKindE.translations] as const;

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
};

export const emptySource = (kind: SourceKindE): SourceStateT => ({ kind, filter: {} });

/** Lists one page of the chosen table through our own API */
export const listRecords = (
  source: SourceStateT,
  page: number,
  limit: number,
): Promise<PaginatedListT<BulkItemT> | ErrorResT> => {
  switch (source.kind) {
    case SourceKindE.words:
      return EnApi.listWords({ ...source.filter, page, limit });
    case SourceKindE.meanings:
      return EnApi.listMeanings({ ...source.filter, page, limit });
    case SourceKindE.translations:
      return EnApi.listMeaningTranslations({ ...source.filter, page, limit });
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
    case SourceKindE.meanings:
      return { ...base, meaning_id: item.id };
    case SourceKindE.translations: {
      const translation = item as EnMeaningTranslationListItemT;
      return {
        ...base,
        meaning_id: translation.meaning_id,
        translation_id: translation.id,
        language: translation.language,
      };
    }
  }
};

/** Short human-readable name of a row for the failures table */
export const toLabel = (kind: SourceKindE, item: BulkItemT): string =>
  kind === SourceKindE.words ? item.word : 'title' in item ? item.title : item.word;

/** How many filter fields are set: shown on the collapsed filters panel */
export const countActiveFilters = (source: SourceStateT): number =>
  Object.values(source.filter).filter((v) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length))
    .length;
