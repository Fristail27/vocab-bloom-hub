import { ServiceUnavailableException } from '@nestjs/common';
import { embeddingProfileId } from './profile';
import { EMBEDDING_DOCUMENT_FORMAT, EMBEDDING_QUERY_FORMAT } from './transfer';

export const semanticSearchEnabled = (env = process.env): boolean =>
  env.SEMANTIC_SEARCH_ENABLED?.trim().toLowerCase() === 'true';

export function semanticSearchConfig(env = process.env) {
  try {
    const url = new URL(env.EMBEDDINGS_URL ?? 'http://localhost:11434');
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error();
    const profile = {
      model: env.EMBEDDINGS_MODEL?.trim() || 'embeddinggemma-2:latest',
      revision: env.EMBEDDINGS_REVISION?.trim() ?? '',
      dimensions: Number(env.EMBEDDINGS_DIMENSIONS ?? '768'),
      normalization: 'l2' as const,
      document_format: EMBEDDING_DOCUMENT_FORMAT,
      query_format: EMBEDDING_QUERY_FORMAT,
    };
    if (!/^[a-f0-9]{64}$/.test(profile.revision)) throw new Error();
    return { url: url.origin, profile, profileId: embeddingProfileId(profile) };
  } catch {
    throw new ServiceUnavailableException('semantic_search_unconfigured');
  }
}
