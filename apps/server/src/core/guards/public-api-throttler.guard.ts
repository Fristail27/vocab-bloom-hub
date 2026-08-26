import { ExecutionContext, Injectable } from '@nestjs/common';
import { AppThrottlerGuard } from './app-throttler.guard';
import { PUBLIC_API_PREFIX } from '../utils/public-api';

/**
 * Rate limit of the public prefix (issue #271): one budget per client for
 * every route under /api/v1 together. The stock guard keys its counters by
 * controller and handler, which would give each endpoint a budget of its own.
 */
@Injectable()
export class PublicApiThrottlerGuard extends AppThrottlerGuard {
  protected generateKey(_context: ExecutionContext, suffix: string, name: string): string {
    return `${PUBLIC_API_PREFIX}-${suffix}-${name}`;
  }
}
