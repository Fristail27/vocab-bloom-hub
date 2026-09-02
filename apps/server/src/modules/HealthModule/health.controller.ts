import { Controller, Get, Header, HttpStatus, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CACHE_CONTROL_NO_STORE } from '../../core/utils/http-cache';
import type { HealthResT, ReadyResT } from '../../../types';
import { HealthService } from './health.service';

export const HEALTH_PATH = '/api/health';
export const READY_PATH = '/api/ready';

/**
 * Probes for process managers, orchestrators and the reverse proxy (issue
 * #315). Under `/api` so the documented proxy configs route them to the
 * server without an extra rule; outside `/api/v1` and the admin prefixes so
 * no login, rate limit or surface switch applies. Never cached.
 */
@ApiTags('Health')
@Controller('/api')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @Header('Cache-Control', CACHE_CONTROL_NO_STORE)
  @ApiOperation({ summary: 'Liveness: the process is up and answers HTTP' })
  @ApiOkResponse({ description: '`{ status: "ok", version }`' })
  health(): HealthResT {
    return this.healthService.health();
  }

  @Get('ready')
  @Header('Cache-Control', CACHE_CONTROL_NO_STORE)
  @ApiOperation({
    summary:
      'Readiness: migrations applied and the database answers; 503 while stopping or without the database',
  })
  @ApiOkResponse({ description: '`{ status: "ok" }` — the instance can take traffic' })
  @ApiServiceUnavailableResponse({
    description:
      '`{ status: "error", reason: "database_unreachable" | "shutting_down" | "importing" | "import_failed" }`',
  })
  async ready(@Res({ passthrough: true }) res: Response): Promise<ReadyResT> {
    const result = await this.healthService.ready();
    if (result.status !== 'ok') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
