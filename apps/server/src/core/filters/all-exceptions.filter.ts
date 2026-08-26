import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request, Response } from 'express';
import { isPublicApiPath, requestPath } from '../utils/public-api';
import { PublicApiErrorT } from '../../../types';

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const requestContext = `${req.method} ${req.url}`;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const message = JSON.stringify(exception.getResponse());
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(`${status} on ${requestContext}: ${message}`, exception.stack);
      } else {
        this.logger.warn(`${status} on ${requestContext}: ${message}`);
      }
    } else {
      this.logger.error(
        `Unhandled exception on ${requestContext}`,
        exception instanceof Error ? exception.stack : String(exception),
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
