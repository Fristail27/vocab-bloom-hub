import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { semanticSearchEnabled, semanticSearchConfig } from './config';
import { embeddingVector } from './profile';

const canonicalModel = (name: string) => (name.split('/').at(-1)!.includes(':') ? name : `${name}:latest`);

/** Query inference only. Never pulls models, generates dictionary vectors or retries. */
@Injectable()
export class OllamaQueryService {
  async embed(query: string, config: ReturnType<typeof semanticSearchConfig>): Promise<number[]> {
    if (!semanticSearchEnabled()) throw new NotFoundException('semantic_search_disabled');
    const signal = AbortSignal.timeout(10_000);
    const json = async (path: string, init: RequestInit = {}): Promise<unknown> => {
      const response = await fetch(`${config.url}${path}`, { ...init, signal, redirect: 'error' });
      if (!response.ok || !response.body) throw new Error('model unavailable');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          if (bytes > 1_048_576) throw new Error('model response too large');
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    };
    const assertModel = async () => {
      const tags = (await json('/api/tags')) as {
        models?: Array<{ name?: string; model?: string; digest?: string }>;
      };
      const match =
        Array.isArray(tags?.models) &&
        tags.models.find(
          (m) => typeof m.name === 'string' && canonicalModel(m.name) === canonicalModel(config.profile.model),
        );
      if (!match || match.digest !== config.profile.revision)
        throw new ServiceUnavailableException('semantic_model_incompatible');
    };
    try {
      await assertModel();
      const result = (await json('/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.profile.model,
          input: `task: search result | query: ${query}`,
          dimensions: config.profile.dimensions,
          truncate: false,
          keep_alive: '30m',
        }),
      })) as { model?: string; embeddings?: number[][] };
      if (
        typeof result?.model !== 'string' ||
        canonicalModel(result.model) !== canonicalModel(config.profile.model) ||
        !Array.isArray(result.embeddings) ||
        result.embeddings.length !== 1
      )
        throw new ServiceUnavailableException('semantic_model_incompatible');
      let vector: number[];
      try {
        vector = embeddingVector(result.embeddings[0], config.profile.dimensions);
      } catch {
        throw new ServiceUnavailableException('semantic_model_incompatible');
      }
      // An updated mutable tag must not quietly change the search space.
      await assertModel();
      return vector;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('semantic_model_unavailable');
    }
  }
}
