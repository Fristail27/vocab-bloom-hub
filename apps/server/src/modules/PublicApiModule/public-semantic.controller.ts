import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PublicApiThrottlerGuard } from '../../core/guards/public-api-throttler.guard';
import { PUBLIC_API_PREFIX, PUBLIC_API_THROTTLE } from '../../core/utils/public-api';
import { semanticSearchEnabled } from '../../core/embeddings/config';
import type { PublicSemanticSearchV1ResT, PublicSemanticStatusV1ResT } from '../../../types';
import { SemanticSearchV1QueryDTO } from './dto/SemanticSearchV1Query.dto';
import { PublicSemanticService } from './public-semantic.service';

@ApiTags('Public API v1')
@Controller(`${PUBLIC_API_PREFIX}/search/semantic`)
@UseGuards(PublicApiThrottlerGuard)
@Throttle(PUBLIC_API_THROTTLE)
export class PublicSemanticController {
  constructor(private readonly semantic: PublicSemanticService) {}

  @Get('status')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Whether the instance enables semantic search',
    description:
      'Reflects only SEMANTIC_SEARCH_ENABLED. Performs no inference and does not promise model/vector availability. Never cached.',
  })
  status(): PublicSemanticStatusV1ResT {
    return { data: { enabled: semanticSearchEnabled() } };
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Find existing meanings from a description',
    description:
      'Separate from spelling search; no lexical fallback. Requires SEMANTIC_SEARCH_ENABLED, PostgreSQL/pgvector, imported current vectors and a matching Ollama model. Disabled = 404 semantic_search_disabled; missing infrastructure, busy service or incompatible model = 503. Returns up to 20 meanings, ordered by cosine similarity then meaning ID. Scores are not confidence probabilities; no calibrated no-answer threshold. No pagination or cross-dataset ranking. Uses the shared public rate budget. Responses are no-store.',
  })
  search(@Query() query: SemanticSearchV1QueryDTO): Promise<PublicSemanticSearchV1ResT> {
    return this.semantic.search(query);
  }
}
