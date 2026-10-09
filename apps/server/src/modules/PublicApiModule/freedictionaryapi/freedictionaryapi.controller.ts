import { Controller, Get, Param, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type {
  FreeDictionaryEntriesResT,
  FreeDictionaryLanguagesResT,
} from '../../../../types/public/freedictionaryapi';
import { PublicApiThrottlerGuard } from '../../../core/guards/public-api-throttler.guard';
import { FREE_DICTIONARY_API_PREFIX, PUBLIC_API_THROTTLE } from '../../../core/utils/public-api';
import { PublicCacheInterceptor } from '../public-cache.interceptor';
import { HEADWORD_MAX_LENGTH, HeadwordParamPipe } from '../utils/headword-param.pipe';
import { FreeDictionaryApiService } from './freedictionaryapi.service';
import { FreeDictionaryJsonInterceptor } from './json.interceptor';
import { validateFreeDictionaryQuery } from './query';

@ApiTags('freedictionaryapi.com compatibility')
@Controller(`${FREE_DICTIONARY_API_PREFIX}/v1`)
@UseGuards(PublicApiThrottlerGuard)
@Throttle(PUBLIC_API_THROTTLE)
@UseInterceptors(PublicCacheInterceptor, FreeDictionaryJsonInterceptor)
export class FreeDictionaryApiController {
  constructor(private readonly dictionary: FreeDictionaryApiService) {}

  @Get('entries/:language/:word')
  @ApiOperation({
    summary: 'freedictionaryapi.com lookup in the active dataset',
    description:
      'Exact spelling. en and all read the English database; other languages and missing spellings return empty entries. Full terms in vocabBloom.',
  })
  @ApiParam({ name: 'language', type: String, description: 'en or all; other values return empty entries' })
  @ApiParam({
    name: 'word',
    schema: { type: 'string', minLength: 1, maxLength: HEADWORD_MAX_LENGTH },
    description: 'Exact case-sensitive spelling, encoded as one URL segment',
  })
  @ApiQuery({
    name: 'translations',
    required: false,
    type: Boolean,
    description: 'Include supported translations; default false. Only true/false, first occurrence wins.',
  })
  @ApiQuery({
    name: 'pretty',
    required: false,
    type: Boolean,
    description: 'Indent JSON with two spaces; default false.',
  })
  entries(
    @Param('language') language: string,
    @Param('word', HeadwordParamPipe) word: string,
    @Req() req: Request,
  ): Promise<FreeDictionaryEntriesResT> {
    const { translations } = validateFreeDictionaryQuery(req, true);
    return this.dictionary.entries(language, word, translations, `${req.protocol}://${req.get('host')}`);
  }

  @Get('languages')
  @ApiOperation({
    summary: 'Available headword languages and readable spelling counts',
    description:
      'English only. Counts include phrases, inflections and alternative-only entry rows in the active dataset, once per readable spelling; unlinked placeholders are excluded.',
  })
  @ApiQuery({
    name: 'pretty',
    required: false,
    type: Boolean,
    description: 'Indent JSON with two spaces; default false.',
  })
  languages(@Req() req: Request): Promise<FreeDictionaryLanguagesResT> {
    validateFreeDictionaryQuery(req, false);
    return this.dictionary.languages();
  }
}
