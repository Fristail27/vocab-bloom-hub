import { createHash } from 'node:crypto';

import type { EmbeddingProfileT } from '../../../types/embeddings';
export type { EmbeddingProfileT } from '../../../types/embeddings';

// pgvector's vector HNSW indexes support at most 2,000 dimensions.
export const MAX_EMBEDDING_DIMENSIONS = 2000;
export const EMBEDDING_NORM_TOLERANCE = 0.001;

export function assertEmbeddingProfile(profile: EmbeddingProfileT): void {
  for (const field of ['model', 'revision', 'document_format', 'query_format'] as const) {
    const value = profile[field];
    if (typeof value !== 'string' || !value.trim() || value.length > 256) {
      throw new Error(`Invalid embedding profile ${field}`);
    }
  }
  if (
    !Number.isInteger(profile.dimensions) ||
    profile.dimensions < 1 ||
    profile.dimensions > MAX_EMBEDDING_DIMENSIONS ||
    profile.normalization !== 'l2'
  ) {
    throw new Error('Invalid embedding dimensions or normalization');
  }
}

/** Immutable identity includes preprocessing, not merely the model name or vector size. */
export function embeddingProfileId(profile: EmbeddingProfileT): string {
  assertEmbeddingProfile(profile);
  return embeddingInputHash(
    JSON.stringify([
      profile.model,
      profile.revision,
      profile.dimensions,
      profile.normalization,
      profile.document_format,
      profile.query_format,
    ]),
  );
}

/** Hash the exact UTF-8 input; no trimming/case folding that could hide a content change. */
export function embeddingInputHash(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Validate and round to the float32 representation used by PostgreSQL real[] / pgvector. */
export function embeddingVector(values: readonly number[], dimensions: number): number[] {
  if (
    !Number.isInteger(dimensions) ||
    dimensions < 1 ||
    dimensions > MAX_EMBEDDING_DIMENSIONS ||
    !Array.isArray(values) ||
    values.length !== dimensions
  ) {
    throw new Error('Invalid embedding dimensions');
  }
  const vector = Array.from(values, (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isFinite(Math.fround(value))) {
      throw new Error('Embedding components must be finite float32 numbers');
    }
    return Math.fround(value);
  });
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (Math.abs(norm - 1) > EMBEDDING_NORM_TOLERANCE) {
    throw new Error('Embedding must have unit L2 norm');
  }
  return vector;
}
