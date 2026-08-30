import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request, Response } from 'express';
import { isPublicApiPath, requestPath } from '../utils/public-api';
import { CACHE_CONTROL_NO_STORE } from '../utils/http-cache';
import { PublicApiErrorT } from '../../../types';

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const requestContext = `${req.method} ${req.url}`;

    // the server's own failures carry the error with its stack (`err` in the
    // JSON line, issue #280); a client's mistake is one warning line
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const message = `${status} on ${requestContext}: ${JSON.stringify(exception.getResponse())}`;
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error({ err: exception, statusCode: status }, message);
      } else {
        this.logger.warn(message);
      }
    } else {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        { err, statusCode: HttpStatus.INTERNAL_SERVER_ERROR },
        `Unhandled exception on ${requestContext}`,
      );
    }

    // Стриминговые эндпоинты (импорт/экспорт) пишут в res напрямую —
    // после отправки заголовков стандартный ответ сформировать уже нельзя.
    if (res.headersSent) {
      res.end();
      return;
    }

    // the public prefix answers every error in one shape (ErrorResT), whatever
    // raised it: guards, pipes, unknown routes or the surface switch
    if (isPublicApiPath(requestPath(req))) {
      // a miss or a rate-limit hit is transient: no cache may serve it later
      res.setHeader('Cache-Control', CACHE_CONTROL_NO_STORE);
      res.status(this.publicStatus(exception)).json(this.publicBody(exception));
      return;
    }

    super.catch(exception, host);
  }

  private publicStatus(exception: unknown): number {
    return exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private publicBody(exception: unknown): PublicApiErrorT {
    const statusCode = this.publicStatus(exception);
    if (!(exception instanceof HttpException)) {
      return { statusCode, message: 'internal_server_error', error: true };
    }
    // Nest packs a string, an array of validation messages or an object; the
    // public contract is one string
    const body = exception.getResponse();
    const raw = typeof body === 'string' ? body : (body as { message?: unknown }).message;
    const message = Array.isArray(raw) ? raw.join('; ') : typeof raw === 'string' ? raw : exception.message;
    return { statusCode, message, error: true };
  }
}
