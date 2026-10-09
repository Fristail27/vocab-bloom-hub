import type { CorsOptionsDelegate } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { Request } from 'express';
import { isDictionaryApiPath, requestPath } from './public-api';

/** Compatibility reads are anonymous and usable from any browser, as upstream is. */
export const apiCorsOptions =
  (origins: string[]): CorsOptionsDelegate<Request> =>
  (req, callback) => {
    callback(
      null,
      isDictionaryApiPath(requestPath(req))
        ? {
            origin: '*',
            methods: ['GET', 'HEAD', 'OPTIONS'],
            credentials: false,
            exposedHeaders: [
              'ETag',
              'Last-Modified',
              'Retry-After',
              'X-RateLimit-Limit',
              'X-RateLimit-Remaining',
              'X-RateLimit-Reset',
            ],
          }
        : { origin: origins, credentials: true },
    );
  };
