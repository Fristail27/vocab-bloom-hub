import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { map, Observable } from 'rxjs';
import { freeDictionaryBoolean, freeDictionaryQuery } from './query';

@Injectable()
export class FreeDictionaryJsonInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<string> {
    const http = context.switchToHttp();
    return next.handle().pipe(
      map((body: unknown) => {
        const pretty = freeDictionaryBoolean(freeDictionaryQuery(http.getRequest<Request>()), 'pretty');
        http.getResponse<Response>().type('application/json');
        return JSON.stringify(body, null, pretty ? 2 : undefined);
      }),
    );
  }
}
