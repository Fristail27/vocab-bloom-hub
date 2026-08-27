import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PublicWordsService } from './public-words.service';
import { PublicMetaService } from './public-meta.service';
import { WordFiltersV1QueryDTO } from './dto/WordFiltersV1Query.dto';
import { PublicMetaV1ResT, PublicWordV1ResT } from '../../../types';
import { PublicApiThrottlerGuard } from '../../core/guards/public-api-throttler.guard';
import { PUBLIC_API_PREFIX, PUBLIC_API_THROTTLE } from '../../core/utils/public-api';

/** Dictionary-wide public reads (issue #272): a random entry and the instance metadata */
@ApiTags('Public API v1')
@Controller(PUBLIC_API_PREFIX)
@UseGuards(PublicApiThrottlerGuard)
@Throttle(PUBLIC_API_THROTTLE)
export class PublicDictionaryController {
  constructor(
    private readonly publicWordsService: PublicWordsService,
    private readonly publicMetaService: PublicMetaService,
  ) {}

  @ApiOperation({
    summary: 'A random dictionary entry matching the filters (base forms unless form_of_word is given)',
  })
  @Get('random')
  async random(@Query() query: WordFiltersV1QueryDTO): Promise<PublicWordV1ResT> {
    return { data: await this.publicWordsService.getRandom(query) };
  }

  @ApiOperation({ summary: 'API and dataset versions, data license and counts of the served dictionary' })
  @Get('meta')
  async meta(): Promise<PublicMetaV1ResT> {
    return { data: await this.publicMetaService.getMeta() };
  }
}
