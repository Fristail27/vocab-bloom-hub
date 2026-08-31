import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PublicSuggestionCreatedV1ResT } from '../../../types';
import { PUBLIC_API_PREFIX } from '../../core/utils/public-api';
import { SuggestionsThrottlerGuard } from './suggestions-throttler.guard';
import { CreateSuggestionV1ReqDTO } from './dto/CreateSuggestionV1Req.dto';
import { SuggestionsService } from './suggestions.service';
import { SUGGESTIONS_THROTTLE } from './constants';

// The one write of the public surface (issue #327): a reader reports a
// mistake in the dictionary data. Its own rate limit is an order of
// magnitude below the general public one — a handful of reports per hour
// per client is plenty for honest use.
@ApiTags('Public API v1')
@Controller(`${PUBLIC_API_PREFIX}/suggestions`)
@UseGuards(SuggestionsThrottlerGuard)
@Throttle(SUGGESTIONS_THROTTLE)
export class PublicSuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @ApiOperation({
    summary: 'Report a mistake in the dictionary data',
    description:
      'Files a report for the instance admin to review: what is wrong with a headword ' +
      '(optionally one specific entry of it) and, ideally, what would be right. The headword must ' +
      'exist in the dictionary. Strictly rate-limited; once too many reports are waiting for the ' +
      'admin the endpoint answers 503 until the queue is worked down.',
  })
  @HttpCode(201)
  @Post('/')
  async create(@Body() body: CreateSuggestionV1ReqDTO): Promise<PublicSuggestionCreatedV1ResT> {
    return { data: await this.suggestionsService.create(body) };
  }
}
