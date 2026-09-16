import { describe, expect, it } from '@jest/globals';
import { decodeWordCursor, encodeWordCursor, wordListFingerprint } from '../utils/cursor';
import { EnPartOfSpeechE, EnWordFormsE, WordLevelE } from '../../../../types';

describe('public words list cursor (issue #272)', () => {
  const filters = wordListFingerprint({});

  it('round-trips a (word, id, filters) triple through an opaque, URL-safe token', () => {
    const cursor = { word: 'put up with', id: 42, filters };
    const token = encodeWordCursor(cursor);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeWordCursor(token)).toEqual(cursor);
  });

  it('keeps non-ASCII headwords intact', () => {
    const cursor = { word: 'café', id: 1, filters };
    expect(decodeWordCursor(encodeWordCursor(cursor))).toEqual(cursor);
  });

  it('rejects tokens it did not produce', () => {
    expect(decodeWordCursor('not a token!')).toBeNull();
    expect(decodeWordCursor(Buffer.from('no-separator').toString('base64url'))).toBeNull();
    expect(decodeWordCursor(Buffer.from(`\x0012\x00${filters}`).toString('base64url'))).toBeNull();
    expect(decodeWordCursor(Buffer.from(`run\x00x\x00${filters}`).toString('base64url'))).toBeNull();
    expect(decodeWordCursor(Buffer.from(`run\x000\x00${filters}`).toString('base64url'))).toBeNull();
    expect(decodeWordCursor(Buffer.from(`run\x00-5\x00${filters}`).toString('base64url'))).toBeNull();
    // the tokens of the alpha carried no filter fingerprint
    expect(decodeWordCursor(Buffer.from('run\x0012').toString('base64url'))).toBeNull();
    expect(decodeWordCursor(Buffer.from('run\x0012\x00nope').toString('base64url'))).toBeNull();
    expect(decodeWordCursor('')).toBeNull();
  });

  it('fingerprints the filter set independently of value order, case of the prefix and defaults (issue #440)', () => {
    expect(wordListFingerprint({})).toMatch(/^[0-9a-f]{8}$/);
    expect(wordListFingerprint({ form_of_word: [EnWordFormsE.base_form] })).toBe(wordListFingerprint({}));
    expect(wordListFingerprint({ search: ' Ru ' })).toBe(wordListFingerprint({ search: 'ru' }));
    expect(wordListFingerprint({ word_level: [WordLevelE.B2, WordLevelE.B1] })).toBe(
      wordListFingerprint({ word_level: [WordLevelE.B1, WordLevelE.B2] }),
    );
    expect(wordListFingerprint({ part_of_speech: [EnPartOfSpeechE.noun] })).not.toBe(wordListFingerprint({}));
    expect(wordListFingerprint({ is_obsolete: false })).not.toBe(wordListFingerprint({}));
  });
});
