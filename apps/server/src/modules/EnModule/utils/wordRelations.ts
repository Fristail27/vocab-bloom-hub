import { FindOptionsRelations } from 'typeorm';
import { EnWord } from '../entities/en_word.entity';

/**
 * How the relations of an entry are loaded: one query per relation, always.
 * The default (joins) multiplies the rows of a word by its forms × meanings ×
 * translations × synonyms × antonyms × short translations — thousands of
 * rows for a loaded verb, ~45 ms on Postgres and seconds on SQLite for one
 * lookup — and even the light `forms → word` join makes SQLite materialize
 * the whole forms table (~0.6 s per page). Separate queries read each
 * collection once and cost a bounded handful of index lookups (issue #279).
 */
export const RELATION_LOAD_STRATEGY = 'query' as const;

/**
 * Everything a full dictionary entry (EnWordT) carries: forms, meanings
 * with their translations and word links, short translations, the phrasal
 * base and its variants. Shared by the admin GET /api/en/:id and the public
 * reads so both answer the same shape.
 */
export const FULL_WORD_RELATIONS: FindOptionsRelations<EnWord> = {
  forms: { word: true },
  meanings: { translations: true, synonyms: true, antonyms: true },
  phrasal_variants: { word: true },
  base_phrasal: { word: true },
  short_translations: true,
  word: true,
};
