/**
 * Cursor of the public words list (issue #272). Pages are ordered by
 * (word, id); the cursor names the last item of a page and the next page
 * starts right after it, so inserts and deletes elsewhere never shift or
 * repeat items — unlike OFFSET paging. The token is opaque to clients:
 * base64url of `word\0id`.
 */
export type WordCursorT = { word: string; id: number };

export const encodeWordCursor = ({ word, id }: WordCursorT): string =>
  Buffer.from(`${word}\0${id}`, 'utf8').toString('base64url');

/** Returns null for anything that is not a token produced by encodeWordCursor */
export const decodeWordCursor = (cursor: string): WordCursorT | null => {
  if (!/^[A-Za-z0-9_-]+$/.test(cursor)) return null;
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const separator = raw.lastIndexOf('\0');
  if (separator < 0) return null;
  const word = raw.slice(0, separator);
  const idPart = raw.slice(separator + 1);
  if (!word || !/^\d+$/.test(idPart)) return null;
  const id = Number(idPart);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  return { word, id };
};
