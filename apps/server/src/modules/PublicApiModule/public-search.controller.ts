import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PublicSearchService } from './public-search.service';
import { SearchDatasetsV1QueryDTO, SearchDetailedV1QueryDTO, SearchV1QueryDTO } from './dto/SearchV1Query.dto';
import {
  PublicDatasetsV1ResT,
  PublicSearchDatasetsV1ResT,
  PublicSearchDetailedV1ResT,
  PublicSearchV1ResT,
} from '../../../types';
import { PublicSearchThrottlerGuard } from '../../core/guards/public-search-throttler.guard';
import { PublicSearchCacheInterceptor } from './public-search-cache.interceptor';
import { PUBLIC_API_PREFIX, PUBLIC_API_THROTTLE } from '../../core/utils/public-api';

@ApiTags('Public API v1')
@Controller(`${PUBLIC_API_PREFIX}/search`)
@UseGuards(PublicSearchThrottlerGuard)
@Throttle(PUBLIC_API_THROTTLE)
@UseInterceptors(PublicSearchCacheInterceptor)
export class PublicSearchController {
  constructor(private readonly search: PublicSearchService) {}

  // Both searches are GET reads (issue #396): the fields travel in the query
  // string and the answer carries the caching headers of the prefix (ETag,
  // Last-Modified, Cache-Control), so a search can sit behind a CDN and be
  // shared as a link. The POST forms of the alpha were removed in the beta
  // (issue #440) — a POST answers 404 like any unknown route.
  @ApiOperation({
    summary: 'Search dictionary entries (flat list, no meanings)',
    description:
      'Tiers in relevance order: exact, phrasal, starts-with, phrases, ends-with, contains. When none matches, ' +
      'a trigram similarity tier answers typos (`meta.fuzzy: true`, `similarity` on every item; Postgres instances only). ' +
      'A term shorter than 3 characters searches the exact and prefix tiers only (`meta.short_term: true`). ' +
      'Cacheable: the answer carries `ETag`, `Last-Modified` and `Cache-Control` like every public GET.',
  })
  @Get('/')
  async searchGet(@Query() query: SearchV1QueryDTO): Promise<PublicSearchV1ResT> {
    return this.search.flat(query);
  }

  @ApiOperation({
    summary: 'Search dictionary entries with pagination, meanings and translations',
    description:
      'The detailed search: the same term and tiers, paged, with meanings and translations joined on request; ' +
      'the fields travel in the query string (`translation_languages` as a repeated key). Cacheable like every public GET.',
  })
  @Get('/detailed')
  async searchDetailedGet(@Query() query: SearchDetailedV1QueryDTO): Promise<PublicSearchDetailedV1ResT> {
    return this.search.detailed(query);
  }

  @ApiOperation({
    summary: 'Search up to five public datasets, in separate groups',
    description:
      'Repeat datasets for each target (1–5 unique names). Groups follow installation order. The detailed search filters, limit (1–20) and page (1–20) apply independently to every group. Relevance scores are local to each dataset. Empty matches have status ok and an empty data array; failed readers have status unavailable and no results/pagination. Unknown or closed targets reject the entire request with 404. Partial failures return 200 with meta.partial and Cache-Control: no-store. Each selected dataset costs one unit of the shared public rate budget, including failed reads. Selected searches revalidate their ETag on every use.',
  })
  @Get('/datasets')
  searchDatasetsGet(@Query() query: SearchDatasetsV1QueryDTO): Promise<PublicSearchDatasetsV1ResT> {
    return this.search.grouped(query);
  }
}

@ApiTags('Public API v1')
@Controller(`${PUBLIC_API_PREFIX}/datasets`)
@UseGuards(PublicSearchThrottlerGuard)
@Throttle(PUBLIC_API_THROTTLE)
@UseInterceptors(PublicSearchCacheInterceptor)
export class PublicDatasetsController {
  constructor(private readonly search: PublicSearchService) {}

  @ApiOperation({ summary: 'Publicly readable datasets and their terms, in installation order' })
  @Get('/')
  list(): Promise<PublicDatasetsV1ResT> {
    return this.search.inventory();
  }
}
