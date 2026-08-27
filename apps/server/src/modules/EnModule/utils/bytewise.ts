import { checkIsPostgres } from '../../../../configuration';

/**
 * A text column compared and ordered by its bytes on every driver. SQLite
 * does that by default; Postgres would apply the database locale, which
 * ignores spaces and cannot use a btree index for a `LIKE 'prefix%'`. The
 * `COLLATE "C"` expressions are backed by `IDX_EN_ENTRY_WORD_C` on
 * `en_entries.word` (search and admin prefix lookups) and `IDX_EN_WORD_C`
 * on `en_words (word, id)` (the public list) — issues #272, #279.
 */
export const bytewise = (column: string): string => (checkIsPostgres() ? `${column} COLLATE "C"` : column);
