import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { EnSearchService } from '../EnModule/modules/EnSearch/enSearch.service';
import { DatasetsService } from '../DatasetsModule/datasets.service';
import { PublicMetaService } from './public-meta.service';
import { SearchDatasetsV1QueryDTO, SearchDetailedV1QueryDTO, SearchV1QueryDTO } from './dto/SearchV1Query.dto';
import {
  PublicDatasetsV1ResT,
  PublicSearchDatasetsV1ResT,
  PublicSearchDetailedV1ResT,
  PublicSearchV1ResT,
} from '../../../types';
import { MAX_SEARCH_DATASETS } from '../../../core/constants/datasets';
import { currentDatasetScope } from '../../core/utils/dataset-scope';
import { LAST_MODIFIED_TTL_MS, newestChangeOn, newestOf } from './dictionary-last-modified.service';
import { cacheSearch } from './public-search-cache.interceptor';
import { Dataset } from '../DatasetsModule/entities/dataset.entity';

@Injectable()
export class PublicSearchService {
  // Last-Modified is informational. Like the active-dictionary cache, avoid
  // scanning timestamp columns for every keystroke; ETags still reflect every edit.
  private readonly contentDates = new Map<number, { value: Date | null; fetchedAt: number }>();
  private revision = 0;

  constructor(
    private readonly search: EnSearchService,
    private readonly datasets: DatasetsService,
    private readonly meta: PublicMetaService,
  ) {
    datasets.onRegistryChanged(() => {
      this.revision++;
      this.contentDates.clear();
    });
  }

  async inventory(): Promise<PublicDatasetsV1ResT> {
    const data = await Promise.all((await this.datasets.publiclyReadable()).map((d) => this.meta.termsOf(d)));
    return cacheSearch(
      { data, meta: { max_search_datasets: MAX_SEARCH_DATASETS } },
      await this.datasets.changedAt(),
    );
  }

  private async read<T>(
    name: string,
    work: (dataset: Dataset) => Promise<T>,
  ): Promise<{ body: T; date: Date | null }> {
    return this.datasets.withPublicRead(name, async (dataset) => {
      const body = await work(dataset);
      const scope = currentDatasetScope()!;
      const revision = this.revision;
      let content = this.contentDates.get(dataset.id);
      if (!content || Date.now() - content.fetchedAt >= LAST_MODIFIED_TTL_MS) {
        content = { value: await newestChangeOn(scope.manager!), fetchedAt: Date.now() };
        if (revision === this.revision) this.contentDates.set(dataset.id, content);
      }
      const date = newestOf([
        content.value,
        dataset.createdAt,
        dataset.terms_updated_at,
        dataset.visibility_updated_at,
        dataset.activated_at,
      ]);
      return { body, date };
    });
  }

  private async single<T extends object>(name: string | undefined, work: () => Promise<T>): Promise<T> {
    if (name === undefined) return work();
    try {
      const { body, date } = await this.read(name, work);
      return cacheSearch(body, date);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException('dataset_unavailable');
    }
  }

  flat(query: SearchV1QueryDTO): Promise<PublicSearchV1ResT> {
    return this.single(query.dataset, async () => {
      const { items, fuzzy, short_term } = await this.search.searchFlat(query);
      return {
        data: items,
        meta: {
          count: items.length,
          fuzzy,
          short_term,
          ...(query.dataset === undefined ? {} : { dataset: query.dataset }),
        },
      };
    });
  }

  detailed(query: SearchDetailedV1QueryDTO): Promise<PublicSearchDetailedV1ResT> {
    return this.single(query.dataset, async () => {
      const { items, ...meta } = await this.search.searchDetailed(query);
      return {
        data: items,
        meta: { ...meta, ...(query.dataset === undefined ? {} : { dataset: query.dataset }) },
      };
    });
  }

  async grouped(query: SearchDatasetsV1QueryDTO): Promise<PublicSearchDatasetsV1ResT> {
    // Validate the complete selection before any dictionary work. This shares
    // the visibility predicate with every other public dataset transport.
    const selected = await this.datasets.selectPublic(query.datasets);
    const data: PublicSearchDatasetsV1ResT['data'] = [];
    const dates: Array<Date | null> = [];
    // Sequential groups bound concurrent readers to one per request. Relevance,
    // IDs and pagination stay inside each dataset's existing search service.
    for (const dataset of selected) {
      try {
        const { body, date } = await this.read(dataset.name, async (current) => {
          const { items, ...meta } = await this.search.searchDetailed(query);
          return { ...(await this.meta.termsOf(current)), status: 'ok' as const, data: items, meta };
        });
        data.push(body);
        dates.push(date);
      } catch (error) {
        // A target closed/deleted during selection must not be named in an error group.
        if (error instanceof NotFoundException) throw error;
        await this.datasets.selectPublic([dataset.name]);
        data.push({
          ...(await this.meta.termsOf(dataset)),
          status: 'unavailable',
          error: 'dataset_unavailable',
        });
      }
    }
    // Recheck visibility after the reads as well, before exposing group terms.
    await this.datasets.selectPublic(query.datasets);
    const partial = data.some((group) => group.status === 'unavailable');
    return cacheSearch({ data, meta: { datasets: data.length, partial } }, newestOf(dates), partial);
  }
}
