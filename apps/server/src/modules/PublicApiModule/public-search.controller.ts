import { Body, Controller, Get, HttpCode, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { EnSearchService } from '../EnModule/modules/EnSearch/enSearch.service';
import { SearchDetailedV1ReqDTO, SearchV1ReqDTO } from './dto/SearchV1Req.dto';
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

  private async flat(request: SearchV1ReqDTO | SearchV1QueryDTO): Promise<PublicSearchV1ResT> {
    const { items, fuzzy, short_term } = await this.enSearchService.searchFlat(request);
    return { data: items, meta: { count: items.length, fuzzy, short_term } };
  }

  private async detailed(
    request: SearchDetailedV1ReqDTO | SearchDetailedV1QueryDTO,
  ): Promise<PublicSearchDetailedV1ResT> {
    const { items, ...meta } = await this.enSearchService.searchDetailed(request);
    return { data: items, meta };
  }

  // The GET form (issue #396) is the one to use: same fields in the query
  // string, same answer, plus the caching headers of the prefix (ETag,
  // Last-Modified, Cache-Control), so a search can sit behind a CDN and be
  // shared as a link. The POST form stays through the beta.
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
      'The GET form of the detailed search: the same fields as the POST body, in the query string; cacheable.',
  })
  @Get('/detailed')
  async searchDetailedGet(@Query() query: SearchDetailedV1QueryDTO): Promise<PublicSearchDetailedV1ResT> {
    return this.detailed(query);
  }

  @ApiOperation({
    summary: 'Search dictionary entries (flat list, no meanings) — the POST form',
    description:
      'The same search as `GET /search` with the fields in a JSON body; not cacheable. Kept through the beta.',
  })
  @HttpCode(200)
  @Post('/')
  async search(@Body() body: SearchV1ReqDTO): Promise<PublicSearchV1ResT> {
    return this.flat(body);
  }

  @ApiOperation({
    summary: 'Search dictionary entries with pagination, meanings and translations — the POST form',
    description:
      'The same search as `GET /search/detailed` with the fields in a JSON body; not cacheable. Kept through the beta.',
  })
  @HttpCode(200)
  @Post('/detailed')
  async searchDetailed(@Body() body: SearchDetailedV1ReqDTO): Promise<PublicSearchDetailedV1ResT> {
    return this.detailed(body);
  }
}
