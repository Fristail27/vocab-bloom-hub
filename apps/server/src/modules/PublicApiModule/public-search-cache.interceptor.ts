import { DatasetsService } from '../DatasetsModule/datasets.service';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { mergeMap } from 'rxjs/operators';
import { DictionaryLastModifiedService } from './dictionary-last-modified.service';
import { publicCacheControl, weakEtagOf } from '../../core/utils/http-cache';
import { getPublicApiCacheMaxAge } from '../../core/utils/public-api';

// Private response metadata, never serialized into the v1 contract. Computed
// inside the selected read's scope, so caching opens no additional readers.
const metadata = new WeakMap<object, { lastModified: Date | null; partial: boolean }>();
export const cacheSearch = <T extends object>(body: T, lastModified: Date | null, partial = false): T => {
  metadata.set(body, { lastModified, partial });
  return body;
};

@Injectable()
export class PublicSearchCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly active: DictionaryLastModifiedService,
    private readonly datasets: DatasetsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      mergeMap(async (body: object) => {
        const selected = metadata.get(body);
        // HTTP dates cannot validate visibility changes within one second.
        if (selected) delete req.headers['if-modified-since'];
        if (!selected) res.setHeader('X-Dataset', this.datasets.getActive().name);
        const date = selected ? selected.lastModified : await this.active.getLastModified();
        res.setHeader(
          'Cache-Control',
          selected
            ? selected.partial
              ? 'no-store'
              : 'public, no-cache, must-revalidate'
            : publicCacheControl(getPublicApiCacheMaxAge()),
        );
        if (selected?.partial) {
          // An intermittent failure must never validate an earlier failed response.
          delete req.headers['if-none-match'];
        }
        res.setHeader('ETag', weakEtagOf(JSON.stringify(body)));
        if (date) res.setHeader('Last-Modified', date.toUTCString());
        return body;
      }),
    );
  }
}
