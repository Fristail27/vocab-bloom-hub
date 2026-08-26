import { EnWordLinkDST } from '../../../../../../types/dictionaries/en/EnDataSetTypes';

/**
 * Reduces dataset word links (synonyms, antonyms) to the headwords the
 * database links to. Current files carry `{ word, part_of_speech }` objects;
 * files exported before the part of speech was added carry plain strings, and
 * files older than the relation carry nothing.
 */
export const wordLinksFromDataSet = (links: Array<EnWordLinkDST | string> | null | undefined): string[] =>
  (links ?? []).map((s) => (typeof s === 'string' ? s : s.word));
