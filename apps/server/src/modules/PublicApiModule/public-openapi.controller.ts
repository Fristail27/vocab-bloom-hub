import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags, type OpenAPIObject } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PublicOpenApiService } from './public-openapi.service';
import { PublicCacheInterceptor } from './public-cache.interceptor';
import { PublicApiThrottlerGuard } from '../../core/guards/public-api-throttler.guard';
import { PUBLIC_API_PREFIX, PUBLIC_API_THROTTLE } from '../../core/utils/public-api';

/** The machine-readable contract of the prefix, served in every environment (issue #273) */
@ApiTags('Public API v1')
@Controller(`${PUBLIC_API_PREFIX}/openapi.json`)
@UseGuards(PublicApiThrottlerGuard)
@Throttle(PUBLIC_API_THROTTLE)
@UseInterceptors(PublicCacheInterceptor)
export class PublicOpenApiController {
  constructor(private readonly publicOpenApiService: PublicOpenApiService) {}

  @ApiOperation({ summary: 'The OpenAPI 3 document of the public API (this contract)' })
  @Get('/')
  openapi(): OpenAPIObject {
    return this.publicOpenApiService.getPublicDocument();
  }
}
