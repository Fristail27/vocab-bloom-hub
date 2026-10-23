import { embeddingInputHash, embeddingProfileId, embeddingVector, type EmbeddingProfileT } from '../profile';

const profile: EmbeddingProfileT = {
  model: 'embeddinggemma-2',
  revision: 'sha256:fixed-revision',
  dimensions: 3,
  normalization: 'l2',
  document_format: 'meaning-v1',
  query_format: 'query-v1',
};

describe('embedding storage validation', () => {
  it('identifies the full model and preprocessing configuration independently of object key order', () => {
    const id = embeddingProfileId(profile);
    expect(id).toMatch(/^[a-f0-9]{64}$/);
    expect(embeddingProfileId({ ...profile, model: profile.model })).toBe(id);
    for (const change of [
      { revision: 'another-revision' },
      { dimensions: 4 },
      { document_format: 'meaning-v2' },
      { query_format: 'query-v2' },
      { model: 'other-model' },
    ])
      expect(embeddingProfileId({ ...profile, ...change })).not.toBe(id);
  });

  it('hashes the exact model input, including Unicode and whitespace', () => {
    expect(embeddingInputHash('птица')).toMatch(/^[a-f0-9]{64}$/);
    expect(embeddingInputHash('птица ')).not.toBe(embeddingInputHash('птица'));
  });

  it.each([0, -1, 1.5, 2001, NaN])('rejects invalid dimensions %s', (dimensions) => {
    expect(() => embeddingProfileId({ ...profile, dimensions })).toThrow();
  });

  it.each(['', ' ', 'x'.repeat(257)])('rejects missing/oversized metadata', (revision) => {
    expect(() => embeddingProfileId({ ...profile, revision })).toThrow();
  });

  it('accepts normalized vectors with float32 rounding without changing the caller input', () => {
    const values = [0.6, 0.8, 0];
    expect(embeddingVector(values, 3)).toEqual(values.map(Math.fround));
    expect(values).toEqual([0.6, 0.8, 0]);
  });

  it.each([[0, 0, 0], [1, 1, 1], [NaN, 0, 1], [Infinity, 0, 1], [1e100, 0, 1], [1, 0], Array(3)])(
    'rejects invalid or non-normalized vectors',
    (...values) => {
      expect(() => embeddingVector(values as number[], 3)).toThrow();
    },
  );
});
