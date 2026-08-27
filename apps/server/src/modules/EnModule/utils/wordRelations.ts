import { FindOptionsRelations } from 'typeorm';
import { EnWord } from '../entities/en_word.entity';

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
