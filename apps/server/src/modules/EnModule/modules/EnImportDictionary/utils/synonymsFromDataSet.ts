import { EnSynonymDST } from '../../../../../../types/dictionaries/en/EnDataSetTypes';

/**
 * Reduces dataset synonyms to the headwords the database links to. Current
 * files carry `{ word, part_of_speech }` objects; files exported before the
 * part of speech was added carry plain strings, and files older than
 * synonyms carry nothing.
 */
export const synonymsFromDataSet = (synonyms: Array<EnSynonymDST | string> | null | undefined): string[] =>
  (synonyms ?? []).map((s) => (typeof s === 'string' ? s : s.word));
