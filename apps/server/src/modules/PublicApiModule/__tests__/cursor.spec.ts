import { describe, expect, it } from '@jest/globals';
import { decodeWordCursor, encodeWordCursor } from '../utils/cursor';

describe('public words list cursor (issue #272)', () => {
  it('round-trips a (word, id) pair through an opaque, URL-safe token', () => {
    const cursor = { word: 'put up with', id: 42 };
    const token = encodeWordCursor(cursor);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeWordCursor(token)).toEqual(cursor);
  });

  it('keeps non-ASCII headwords intact', () => {
    const cursor = { word: 'café', id: 1 };
    expect(decodeWordCursor(encodeWordCursor(cursor))).toEqual(cursor);
  });

  it('rejects tokens it did not produce', () => {
    expect(decodeWordCursor('not a token!')).toBeNull();
    expect(decodeWordCursor(Buffer.from('no-separator').toString('base64url'))).toBeNull();
    expect(decodeWordCursor(Buffer.from('\x0012').toString('base64url'))).toBeNull();
    expect(decodeWordCursor(Buffer.from('run\x00x').toString('base64url'))).toBeNull();
    expect(decodeWordCursor(Buffer.from('run\x000').toString('base64url'))).toBeNull();
    expect(decodeWordCursor(Buffer.from('run\x00-5').toString('base64url'))).toBeNull();
    expect(decodeWordCursor('')).toBeNull();
  });
});
