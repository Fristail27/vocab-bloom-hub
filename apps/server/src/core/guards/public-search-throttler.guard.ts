import { Injectable } from '@nestjs/common';
import type { ThrottlerRequest } from '@nestjs/throttler';
import { PublicApiThrottlerGuard } from './public-api-throttler.guard';
import { MAX_SEARCH_DATASETS } from '../../../core/constants/datasets';

/** Same public budget, one unit per requested dataset, charged before any queries. */
@Injectable()
export class PublicSearchThrottlerGuard extends PublicApiThrottlerGuard {
  protected async handleRequest(props: ThrottlerRequest): Promise<boolean> {
    const { query } = props.context.switchToHttp().getRequest<{ query: { datasets?: unknown } }>();
    const cost = Array.isArray(query.datasets)
      ? Math.min(MAX_SEARCH_DATASETS, Math.max(1, query.datasets.length))
      : 1;
    for (let i = 0; i < cost; i++) await super.handleRequest(props);
    return true;
  }
}
