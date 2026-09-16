import { checkIsPostgres } from '../../../../configuration';

/**
 * A headword column compared and ordered case-insensitively by its bytes on
 * every driver: `LOWER(col) COLLATE "C"` on Postgres (the database locale
 * would ignore spaces and cannot use a btree for `LIKE 'prefix%'`), `LOWER(col)`
 * on SQLite, whose text order is bytewise already. Headwords are lower case
 * except the grammar patterns, which keep their sentence capitals ("It’s the
 * first time …", issue #440): folding the case keeps them in the A–Z order
 * and reachable through a prefix or an exact lookup typed in lower case. The
 * expressions are backed by `IDX_EN_ENTRY_WORD_LOWER_C` on `en_entries.word`
 * (search and admin prefix lookups) and `IDX_EN_WORD_LOWER_C` on
 * `en_words (LOWER(word), id)` (the public list) — issues #272, #279, #440.
 */
export const foldedWord = (column: string): string =>
  checkIsPostgres() ? `LOWER(${column}) COLLATE "C"` : `LOWER(${column})`;

/**
 * The case-insensitive LIKE of the driver for the substring tiers: ILIKE is
 * what the trigram GIN index serves on Postgres; SQLite's LIKE folds ASCII
 * case by itself.
 */
export const likeIgnoringCase = (): string => (checkIsPostgres() ? 'ILIKE' : 'LIKE');
