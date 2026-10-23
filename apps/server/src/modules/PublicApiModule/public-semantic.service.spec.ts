import { PublicSemanticService } from './public-semantic.service';
import { DatasetsService } from '../DatasetsModule/datasets.service';
import { PublicMetaService } from './public-meta.service';
import { OllamaQueryService } from '../../core/embeddings/ollama-query.service';
import { PublicSemanticSearchV1ResT } from '../../../types';

it('enforces the independent switch before storage/model work and bounds outstanding queries', async () => {
  const previous = { ...process.env };
  const waiting: Array<(value: PublicSemanticSearchV1ResT) => void> = [];
  const withPublicRead = jest.fn(
    () =>
      new Promise<PublicSemanticSearchV1ResT>((resolve) => {
        waiting.push(resolve);
      }),
  );
  const embed = jest.fn();
  const service = new PublicSemanticService(
    { withPublicRead, getActive: () => ({ name: 'default' }) } as unknown as DatasetsService,
    {} as PublicMetaService,
    { embed } as unknown as OllamaQueryService,
  );
  try {
    delete process.env.SEMANTIC_SEARCH_ENABLED;
    await expect(service.search({ query: 'birds', limit: 10 })).rejects.toThrow('semantic_search_disabled');
    expect(withPublicRead).not.toHaveBeenCalled();
    expect(embed).not.toHaveBeenCalled();
    process.env.SEMANTIC_SEARCH_ENABLED = 'true';
    process.env.EMBEDDINGS_REVISION = 'a'.repeat(64);
    const first = service.search({ query: 'birds', limit: 10 });
    const second = service.search({ query: 'birds', limit: 10 });
    await expect(service.search({ query: 'birds', limit: 10 })).rejects.toThrow('semantic_search_busy');
    waiting.splice(0).forEach((resolve) => resolve({} as PublicSemanticSearchV1ResT));
    await Promise.all([first, second]);
    const next = service.search({ query: 'birds', limit: 10 });
    waiting[0]({} as PublicSemanticSearchV1ResT);
    await next;
  } finally {
    for (const key of ['SEMANTIC_SEARCH_ENABLED', 'EMBEDDINGS_REVISION']) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
