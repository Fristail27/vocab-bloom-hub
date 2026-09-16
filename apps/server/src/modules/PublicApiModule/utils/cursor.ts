import { createHash } from 'node:crypto';
import { EnWordFormsE } from '../../../../types';
import { WordFiltersV1QueryDTO } from '../dto/WordFiltersV1Query.dto';

/**
 * Cursor of the public words list (issue #272). Pages are ordered by
 * (word, id); the cursor names the last item of a page and the next page
 * starts right after it, so inserts and deletes elsewhere never shift or
 * repeat items — unlike OFFSET paging. The token is opaque to clients:
 * base64url of `word\0id\0filters`, where `filters` is a fingerprint of the
 * filter set the page was read with (issue #440): a cursor handed back with
 * other filters would silently continue another listing from that position,
 * so it is refused as `invalid_cursor` instead.
 */
export type WordCursorT = { word: string; id: number; filters: string };

const sortedValues = (values: string[] | undefined): string[] => (values ? [...values].sort() : []);

/** The fingerprint of the filters a page was read with, as the cursor carries it */
export const wordListFingerprint = (filters: Partial<WordFiltersV1QueryDTO>): string => {
  const canonical = JSON.stringify({
    search: filters.search?.trim().toLowerCase() ?? '',
    is_obsolete: filters.is_obsolete ?? null,
    part_of_speech: sortedValues(filters.part_of_speech),
    word_level: sortedValues(filters.word_level),
    language_register: sortedValues(filters.language_register),
    category: sortedValues(filters.category),
    area_variant: sortedValues(filters.area_variant),
    form_of_word: sortedValues(filters.form_of_word?.length ? filters.form_of_word : [EnWordFormsE.base_form]),
  });
  return createHash('sha1').update(canonical).digest('hex').slice(0, 8);
};

export const encodeWordCursor = ({ word, id, filters }: WordCursorT): string =>
  Buffer.from(`${word}\0${id}\0${filters}`, 'utf8').toString('base64url');

/** Returns null for anything that is not a token produced by encodeWordCursor */
export const decodeWordCursor = (cursor: string): WordCursorT | null => {
  if (!/^[A-Za-z0-9_-]+$/.test(cursor)) return null;
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const parts = raw.split('\0');
  if (parts.length !== 3) return null;
  const [word, idPart, filters] = parts;
  if (!word || !/^\d+$/.test(idPart) || !/^[0-9a-f]{8}$/.test(filters)) return null;
  const id = Number(idPart);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  return { word, id, filters };
};
