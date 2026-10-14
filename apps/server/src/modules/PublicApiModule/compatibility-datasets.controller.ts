import { Controller, Get, Param, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type {
  DictionaryApiV1DatasetsResT,
  DictionaryApiV2DatasetsResT,
  FreeDictionaryDatasetsResT,
} from '../../../types/public/compatibility-datasets';
import { PublicApiThrottlerGuard } from '../../core/guards/public-api-throttler.guard';
import { PUBLIC_API_THROTTLE } from '../../core/utils/public-api';
import { PublicDatasetsCacheInterceptor } from './public-cache.interceptor';
import { HEADWORD_MAX_LENGTH, HeadwordParamPipe } from './utils/headword-param.pipe';
import { HEADWORD_PARAM } from './public-words.controller';
import { validateDictionaryApiRequest } from './dictionaryapi/query';
import { validateFreeDictionaryQuery } from './freedictionaryapi/query';
import { FreeDictionaryJsonInterceptor } from './freedictionaryapi/json.interceptor';
import { CompatibilityDatasetsService } from './compatibility-datasets.service';

const DICTIONARY_DESCRIPTION =
  'One group per installed dataset with its terms, status and response in the adapter format. ' +
  'Missing words have status 404 and the adapter error in response. The outer request returns 200 even ' +
  'when no dataset matches. English only; the usual headword and inflection rules apply in each dataset. ' +
  'No query parameters. Does not activate any dataset. One public rate-limit unit; cached across all datasets.';

@Controller('/api/compat')
@UseGuards(PublicApiThrottlerGuard)
@Throttle(PUBLIC_API_THROTTLE)
@UseInterceptors(PublicDatasetsCacheInterceptor)
export class CompatibilityDatasetsController {
  constructor(private readonly datasets: CompatibilityDatasetsService) {}

  @Get('dictionaryapi/v2/entries/:language/:word/datasets')
  @ApiTags('dictionaryapi.dev compatibility')
  @ApiOperation({
    summary: 'dictionaryapi.dev v2 responses from every open dataset',
    description: DICTIONARY_DESCRIPTION,
  })
  @ApiParam({ name: 'language', enum: ['en', 'en_US', 'en_GB'] })
  @ApiParam(HEADWORD_PARAM)
  dictionaryApiV2(
    @Param('language') language: string,
    @Param('word', HeadwordParamPipe) word: string,
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
  ): Promise<DictionaryApiV2DatasetsResT> {
    validateDictionaryApiRequest(language, query);
    return this.datasets.dictionaryApiV2(language, word, `${request.protocol}://${request.get('host')}`);
  }

  @Get('dictionaryapi/v1/entries/:language/:word/datasets')
  @ApiTags('dictionaryapi.dev compatibility')
  @ApiOperation({
    summary: 'dictionaryapi.dev v1 responses from every open dataset',
    description: DICTIONARY_DESCRIPTION,
  })
  @ApiParam({ name: 'language', enum: ['en', 'en_US', 'en_GB'] })
  @ApiParam(HEADWORD_PARAM)
  dictionaryApiV1(
    @Param('language') language: string,
    @Param('word', HeadwordParamPipe) word: string,
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
  ): Promise<DictionaryApiV1DatasetsResT> {
    validateDictionaryApiRequest(language, query);
    return this.datasets.dictionaryApiV1(language, word, `${request.protocol}://${request.get('host')}`);
  }

  @Get('freedictionaryapi/v1/entries/:language/:word/datasets')
  @ApiTags('freedictionaryapi.com compatibility')
  @ApiOperation({
    summary: 'freedictionaryapi.com responses from every open dataset',
    description:
      'One group per installed dataset with its terms, status 200 and the adapter object in response. ' +
      'Exact spelling; en and all read English. Missing words and other languages have empty response.entries. ' +
      'The outer request returns 200 even when no dataset matches. Does not activate any dataset. ' +
      'One public rate-limit unit; cached across all datasets. Empty source links point here rather than active-only /meta.',
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
    description: 'Indent the whole response with two spaces; default false.',
  })
  @UseInterceptors(FreeDictionaryJsonInterceptor)
  freeDictionaryApi(
    @Param('language') language: string,
    @Param('word', HeadwordParamPipe) word: string,
    @Req() request: Request,
  ): Promise<FreeDictionaryDatasetsResT> {
    const { translations } = validateFreeDictionaryQuery(request, true);
    return this.datasets.freeDictionaryApi(
      language,
      word,
      translations,
      `${request.protocol}://${request.get('host')}`,
    );
  }
}
