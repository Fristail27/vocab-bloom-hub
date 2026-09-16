import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { EnSearchService } from '../EnModule/modules/EnSearch/enSearch.service';
import { SearchDetailedV1QueryDTO, SearchV1QueryDTO } from './dto/SearchV1Query.dto';
import { PublicSearchDetailedV1ResT, PublicSearchV1ResT } from '../../../types';
import { PublicApiThrottlerGuard } from '../../core/guards/public-api-throttler.guard';
import { PublicCacheInterceptor } from './public-cache.interceptor';
import { PUBLIC_API_PREFIX, PUBLIC_API_THROTTLE } from '../../core/utils/public-api';

@ApiTags('Public API v1')
@Controller(`${PUBLIC_API_PREFIX}/search`)
@UseGuards(PublicApiThrottlerGuard)
@Throttle(PUBLIC_API_THROTTLE)
@UseInterceptors(PublicCacheInterceptor)
export class PublicSearchController {
  constructor(private readonly enSearchService: EnSearchService) {}

  private async flat(request: SearchV1QueryDTO): Promise<PublicSearchV1ResT> {
    const { items, fuzzy, short_term } = await this.enSearchService.searchFlat(request);
    return { data: items, meta: { count: items.length, fuzzy, short_term } };
  }

  private async detailed(request: SearchDetailedV1QueryDTO): Promise<PublicSearchDetailedV1ResT> {
    const { items, ...meta } = await this.enSearchService.searchDetailed(request);
    return { data: items, meta };
  }

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
    return this.flat(query);
  }

  @ApiOperation({
    summary: 'Search dictionary entries with pagination, meanings and translations',
    description:
      'The detailed search: the same term and tiers, paged, with meanings and translations joined on request; ' +
      'the fields travel in the query string (`translation_languages` as a repeated key). Cacheable like every public GET.',
  })
  @Get('/detailed')
  async searchDetailedGet(@Query() query: SearchDetailedV1QueryDTO): Promise<PublicSearchDetailedV1ResT> {
    return this.detailed(query);
  }
}
