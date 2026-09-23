import { ExecutionContext, Injectable } from '@nestjs/common';
import { AppThrottlerGuard } from './app-throttler.guard';
import { isInternalRequest, PUBLIC_API_PREFIX } from '../utils/public-api';

/**
 * Rate limit of the public prefix (issue #271): one budget per client for
 * every route under /api/v1 together. The stock guard keys its counters by
 * controller and handler, which would give each endpoint a budget of its own.
 *
 * The instance's own website is exempt: its server-side requests carry
 * `INTERNAL_API_TOKEN` (`X-Internal-Token`), so the headword walk behind its
 * sitemaps does not starve the word pages it renders from the same address.
 */
@Injectable()
export class PublicApiThrottlerGuard extends AppThrottlerGuard {
  protected generateKey(_context: ExecutionContext, suffix: string, name: string): string {
    return `${PUBLIC_API_PREFIX}-${suffix}-${name}`;
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (await super.shouldSkip(context)) return true;
    const { headers } = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    return isInternalRequest(headers);
  }
}
