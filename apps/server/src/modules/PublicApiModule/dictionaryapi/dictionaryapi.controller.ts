import type { Request } from 'express';
import {
  BadRequestException,
  Query,
  Req,
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { DictionaryApiV1ResT, DictionaryApiV2ResT } from '../../../../types/public/dictionaryapi';
import { PublicApiThrottlerGuard } from '../../../core/guards/public-api-throttler.guard';
import { DICTIONARY_API_PREFIX, PUBLIC_API_THROTTLE } from '../../../core/utils/public-api';
import { PublicCacheInterceptor } from '../public-cache.interceptor';
import { currentDatasetName } from '../../../core/utils/dataset-scope';
import { PublicWordsService } from '../public-words.service';
import { HeadwordParamPipe } from '../utils/headword-param.pipe';
import { HEADWORD_PARAM } from '../public-words.controller';
import { toDictionaryApiV1, toDictionaryApiV2 } from './projection';

@ApiTags('dictionaryapi.dev compatibility')
@Controller(DICTIONARY_API_PREFIX)
@UseGuards(PublicApiThrottlerGuard)
@Throttle(PUBLIC_API_THROTTLE)
@UseInterceptors(PublicCacheInterceptor)
export class DictionaryApiController {
  constructor(private readonly words: PublicWordsService) {}

  private read(language: string, word: string, query: Record<string, unknown>) {
    if (Object.keys(query).length) throw new BadRequestException('Query parameters are not supported');
    // The historical English aliases are locale hints, not separate databases.
    if (!['en', 'en_us', 'en_gb'].includes(language.toLowerCase())) throw new NotFoundException();
    return this.words.getByHeadword(word);
  }

  @Get('v2/entries/:language/:word')
  @ApiOperation({
    summary: 'dictionaryapi.dev v2 lookup in the active dataset',
    description:
      'Array response, with lossless provenance in vocabBloom. English only; native headword and inflection resolution. No dataset query parameter.',
  })
  @ApiParam({ name: 'language', enum: ['en', 'en_US', 'en_GB'] })
  @ApiParam(HEADWORD_PARAM)
  async v2(
    @Param('language') language: string,
    @Param('word', HeadwordParamPipe) word: string,
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
  ): Promise<DictionaryApiV2ResT> {
    return toDictionaryApiV2(
      (await this.read(language, word, query)).data,
      currentDatasetName(),
      `${request.protocol}://${request.get('host')}`,
    );
  }

  @Get('v1/entries/:language/:word')
  @ApiOperation({
    summary: 'dictionaryapi.dev legacy v1 lookup in the active dataset',
    description:
      'Same entries and terms as v2, with a meaning object keyed by part of speech instead of meanings. English only.',
  })
  @ApiParam({ name: 'language', enum: ['en', 'en_US', 'en_GB'] })
  @ApiParam(HEADWORD_PARAM)
  async v1(
    @Param('language') language: string,
    @Param('word', HeadwordParamPipe) word: string,
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
  ): Promise<DictionaryApiV1ResT> {
    return toDictionaryApiV1(
      (await this.read(language, word, query)).data,
      currentDatasetName(),
      `${request.protocol}://${request.get('host')}`,
    );
  }
}
