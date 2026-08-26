import {
  EnMeaningDST,
  EnMeaningTranslationDST,
  EnShortTranslationDST,
  EnWordFormDST,
  EnWordLinkDST,
} from '../../../../../../types/dictionaries/en/EnDataSetTypes';

/**
 * Ordering rules of the exported dataset (issue #247).
 *
 * Everything the database may return in an arbitrary order — the lines of each
 * jsonl file and every relation array inside a line — is sorted here by its
 * natural keys, so two exports of logically identical data are byte-identical
 * regardless of which database produced them, of the internal ids, or of the
 * order rows were inserted in:
 *
 * - jsonl lines: `word`, then `part_of_speech`, then `area_variant`
 *   (see `compareExportLineKeys`);
 * - `meanings`: `sort_order`, then `title`, then `definition`, then `area_variant`;
 * - `meanings[].translations`: `language`, then `title`, then `definition`;
 * - `short_translations`: `language`, then `description`;
 * - `forms`: `form_of_word`, then `word`, then `area_variant`, then `transcription`;
 * - `meanings[].synonyms` and `meanings[].antonyms`: `word`, then
 *   `part_of_speech` (sets of links, the stored order carries no meaning);
 * - `phrasal_variants` and `categories`: plain string order.
 *
 * Arrays whose order is authored and carries meaning (`examples`, `pattern`,
 * `variants_of_words`) are exported exactly as stored.
 *
 * Strings are compared by UTF-16 code units — never by locale — so the result
 * does not depend on ICU data or on the database collation.
 */

type SortKey = string | number | null | undefined;
type KeyFn<T> = (item: T) => SortKey;

export const compareStrings = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const compareKeys = (a: SortKey, b: SortKey): number => {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return compareStrings(String(a ?? ''), String(b ?? ''));
};

/**
 * Builds a comparator that checks the given keys in order. When every key is
 * equal the serialized items are compared, so the order is still total and
 * does not fall back to insertion order.
 */
export const compareBy =
  <T>(...keys: KeyFn<T>[]) =>
  (a: T, b: T): number => {
    for (const key of keys) {
      const res = compareKeys(key(a), key(b));
      if (res !== 0) return res;
    }
    return compareStrings(JSON.stringify(a), JSON.stringify(b));
  };

export const sortStrings = <T extends string>(items: T[] | null | undefined): T[] =>
  [...(items ?? [])].sort(compareStrings);

export const sortMeaningsForDS = (meanings: EnMeaningDST[]): EnMeaningDST[] =>
  [...meanings].sort(
    compareBy(
      (m) => m.sort_order,
      (m) => m.title,
      (m) => m.definition,
      (m) => m.area_variant,
    ),
  );

export const sortWordLinksForDS = (links: EnWordLinkDST[]): EnWordLinkDST[] =>
  [...links].sort(
    compareBy(
      (s) => s.word,
      (s) => s.part_of_speech,
    ),
  );

export const sortMeaningTranslationsForDS = (
  translations: EnMeaningTranslationDST[],
): EnMeaningTranslationDST[] =>
  [...translations].sort(
    compareBy(
      (t) => t.language,
      (t) => t.title,
      (t) => t.definition,
    ),
  );

export const sortShortTranslationsForDS = (translations: EnShortTranslationDST[]): EnShortTranslationDST[] =>
  [...translations].sort(
    compareBy(
      (t) => t.language,
      (t) => t.description,
    ),
  );

export const sortFormsForDS = (forms: EnWordFormDST[]): EnWordFormDST[] =>
  [...forms].sort(
    compareBy(
      (f) => f.form_of_word,
      (f) => f.word,
      (f) => f.area_variant,
      (f) => f.transcription,
    ),
  );

/** The natural key of one jsonl line; the export streams records in this order */
export type ExportLineKeyT = {
  id: number;
  word: string;
  part_of_speech: string;
  area_variant: string | null | undefined;
};

// The id only breaks ties between otherwise indistinguishable rows (same
// word, part of speech and area variant) so the keyset stays a total order
export const compareExportLineKeys = (a: ExportLineKeyT, b: ExportLineKeyT): number =>
  compareStrings(a.word, b.word) ||
  compareStrings(a.part_of_speech, b.part_of_speech) ||
  compareStrings(a.area_variant ?? '', b.area_variant ?? '') ||
  a.id - b.id;
