import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { EnSearchService } from './enSearch.service';
import { SearchReqDTO } from './dto/SearchReq.dto';
import { SearchResT } from '../../../../../types';
import { AppThrottlerGuard } from '../../../../core/guards/app-throttler.guard';

@ApiTags('En_Words')
@Controller('/api/en/search/')
export class EnSearchController {
  constructor(private readonly enSearchService: EnSearchService) {}

  @UseGuards(AppThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 10_000 } })
  @Post('/')
  async search(@Body() body: SearchReqDTO): Promise<SearchResT> {
    return this.enSearchService.search(body);
  }
}
