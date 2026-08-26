import { Body, Controller, Header, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { EnSearchService } from './enSearch.service';
import { SearchReqDTO } from './dto/SearchReq.dto';
import { SearchDetailedReqDTO } from './dto/SearchDetailedReq.dto';
import { SearchDetailedResT, SearchResT } from '../../../../../types';
import { AppThrottlerGuard } from '../../../../core/guards/app-throttler.guard';

// Deprecated aliases of /api/v1/search and /api/v1/search/detailed (issue
// #271): same request, the bare pre-envelope response. They stay until the
// alpha so existing consumers keep working; new ones should use /api/v1
@ApiTags('En_Words')
@Controller('/api/en/search/')
export class EnSearchController {
  constructor(private readonly enSearchService: EnSearchService) {}

  @ApiOperation({ deprecated: true, summary: 'Deprecated alias of POST /api/v1/search' })
  @Header('Deprecation', 'true')
  @Header('Link', '</api/v1/search>; rel="successor-version"')
  @UseGuards(AppThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 10_000 } })
  @Post('/')
  async search(@Body() body: SearchReqDTO): Promise<SearchResT> {
    return this.enSearchService.search(body);
  }

  @ApiOperation({ deprecated: true, summary: 'Deprecated alias of POST /api/v1/search/detailed' })
  @Header('Deprecation', 'true')
  @Header('Link', '</api/v1/search/detailed>; rel="successor-version"')
  @UseGuards(AppThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 10_000 } })
  @Post('/detailed')
  async searchDetailed(@Body() body: SearchDetailedReqDTO): Promise<SearchDetailedResT> {
    return this.enSearchService.searchDetailed(body);
  }
}
