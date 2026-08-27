import { Body, Controller, HttpCode, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { EnSearchService } from '../EnModule/modules/EnSearch/enSearch.service';
import { SearchDetailedV1ReqDTO, SearchV1ReqDTO } from './dto/SearchV1Req.dto';
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

  @ApiOperation({ summary: 'Search dictionary entries (flat list, no meanings)' })
  @HttpCode(200)
  @Post('/')
  async search(@Body() body: SearchV1ReqDTO): Promise<PublicSearchV1ResT> {
    const data = await this.enSearchService.search(body);
    return { data, meta: { count: data.length } };
  }

  @ApiOperation({ summary: 'Search dictionary entries with pagination, meanings and translations' })
  @HttpCode(200)
  @Post('/detailed')
  async searchDetailed(@Body() body: SearchDetailedV1ReqDTO): Promise<PublicSearchDetailedV1ResT> {
    const { items, ...meta } = await this.enSearchService.searchDetailed(body);
    return { data: items, meta };
  }
}
