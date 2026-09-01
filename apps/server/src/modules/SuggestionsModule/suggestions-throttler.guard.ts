import { ExecutionContext, Injectable } from '@nestjs/common';
import { AppThrottlerGuard } from '../../core/guards/app-throttler.guard';

/**
 * The intake's own budget (issue #327): a counter separate from the shared
 * /api/v1 budget of PublicApiThrottlerGuard — reading the dictionary must
 * not eat into the handful of reports a client may file, and vice versa.
 */
@Injectable()
export class SuggestionsThrottlerGuard extends AppThrottlerGuard {
  protected generateKey(_context: ExecutionContext, suffix: string, name: string): string {
    return `suggestions-${suffix}-${name}`;
  }
}
