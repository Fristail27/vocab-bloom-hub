import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { DictionaryLastModifiedService } from './dictionary-last-modified.service';
import { getPublicApiCacheMaxAge } from '../../core/utils/public-api';
import { publicCacheControl, weakEtagOf } from '../../core/utils/http-cache';

/**
 * Caching headers of the public GET reads (issue #274): `Cache-Control:
 * public, max-age=<PUBLIC_API_CACHE_MAX_AGE>`, a weak `ETag` hashed from
 * the JSON body and `Last-Modified` from the dictionary's newest change.
 * Express compares them with `If-None-Match` / `If-Modified-Since` while
 * sending and answers `304 Not Modified` without a body when they match.
 * POST reads (the search) are left alone: HTTP caches do not store them.
 */
@Injectable()
export class PublicCacheInterceptor implements NestInterceptor {
  constructor(private readonly lastModifiedService: DictionaryLastModifiedService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    if (req.method !== 'GET') {
      return next.handle();
    }
    return next.handle().pipe(
      mergeMap(async (body: unknown) => {
        const lastModified = await this.lastModifiedService.getLastModified();
        res.setHeader('Cache-Control', publicCacheControl(getPublicApiCacheMaxAge()));
        // the same string Express is about to send (res.json → JSON.stringify)
        res.setHeader('ETag', weakEtagOf(JSON.stringify(body)));
        if (lastModified) {
          res.setHeader('Last-Modified', lastModified.toUTCString());
        }
        return body;
      }),
    );
  }
}
