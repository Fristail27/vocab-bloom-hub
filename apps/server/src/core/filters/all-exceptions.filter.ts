import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request, Response } from 'express';

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

    super.catch(exception, host);
  }
}
