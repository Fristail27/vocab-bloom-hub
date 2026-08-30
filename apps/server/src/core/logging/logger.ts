import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { LoggerService } from '@nestjs/common';
import type { Request } from 'express';
import { Logger as PinoNestLogger, Params, PinoLogger } from 'nestjs-pino';
import pino, { type DestinationStream, type Level } from 'pino';
import type { Options as PinoHttpOptions } from 'pino-http';
import pretty from 'pino-pretty';
import { HEALTH_PATH, READY_PATH } from '../../modules/HealthModule/health.controller';
import { getMetricsPath, isMetricsEnabled } from '../../modules/MetricsModule/metrics.config';
import { getLogFormat, getLogLevel, isRequestId, LogFormat } from './logging.config';

export const REQUEST_ID_HEADER = 'x-request-id';

export type LoggerOptions = {
  level?: Level;
  format?: LogFormat;
  /** Where the lines go (tests capture them); stdout by default */
  stream?: DestinationStream;
};

type SerializedRequest = {
  id?: string;
  method?: string;
  url?: string;
  remoteAddress?: string;
  headers?: Record<string, string | string[] | undefined>;
  raw?: Request;
};

// Inside a middleware mounted with a path Express strips that path from
// req.url; originalUrl is the request as it came in
const requestUrl = (req: IncomingMessage): string => (req as Partial<Request>).originalUrl ?? req.url ?? '';

// Liveness and readiness are polled every few seconds by the process manager
// and the proxy, the metrics endpoint by Prometheus: they never make the log
const isProbe = (req: IncomingMessage): boolean => {
  const path = requestUrl(req).split('?')[0];
  return path === HEALTH_PATH || path === READY_PATH || (isMetricsEnabled() && path === getMetricsPath());
};

const requestLine = (req: IncomingMessage, res: ServerResponse, responseTime: number): string =>
  `${req.method} ${requestUrl(req)} ${res.statusCode} ${responseTime}ms${req.readableAborted ? ' (aborted)' : ''}`;

const httpOptions: PinoHttpOptions = {
  genReqId: (req, res) => {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const id = isRequestId(incoming) ? incoming : randomUUID();
    res.setHeader(REQUEST_ID_HEADER, id);
    return id;
  },
  autoLogging: { ignore: isProbe },
  // one line per request, at `error` for a failure of the server's own
  customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : 'info'),
  customSuccessMessage: requestLine,
  // pino-http passes the duration as a fourth argument its typings omit
  customErrorMessage: ((req: IncomingMessage, res: ServerResponse, _err: Error, responseTime: number) =>
    requestLine(req, res, responseTime)) as PinoHttpOptions['customErrorMessage'],
  // the lines an application logger writes while handling a request carry
  // the request id only; the request itself is described once, on completion
  quietReqLogger: true,
  serializers: {
    // method, path and who called — not the headers: the authorization header
    // and the admin cookie never reach the log
    req: (req: SerializedRequest) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.raw?.ip ?? req.remoteAddress,
      userAgent: req.headers?.['user-agent'],
    }),
    res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
  },
};

/**
 * The pino configuration behind every server log line (issue #280): JSON for a
 * log collector or pino-pretty for a terminal, the level from LOG_LEVEL, a
 * request line with `x-request-id`, method, path, status and duration.
 */
export const createLoggerParams = (options: LoggerOptions = {}): Params => {
  const level = options.level ?? getLogLevel();
  const format = options.format ?? getLogFormat();
  const stream =
    options.stream ??
    (format === 'pretty'
      ? pretty({
          sync: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname,context,reqId,req,res,responseTime',
          messageFormat: '{if context}[{context}] {end}{msg}',
        })
      : // synchronous writes: nothing is lost when the process exits right
        // after a fatal line (a configuration error, the shutdown watchdog)
        pino.destination({ fd: 1, sync: true }));

  const logger = pino(
    {
      level,
      timestamp: pino.stdTimeFunctions.isoTime,
      // `"level":"error"` rather than `"level":50` in the JSON lines
      formatters: format === 'json' ? { level: (label) => ({ level: label }) } : {},
      // belt and braces: the serializers above never log headers, but a
      // request object logged by hand still cannot leak the credentials
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        censor: '[Redacted]',
      },
    },
    stream,
  );

  return {
    pinoHttp: { ...httpOptions, logger },
    // the string form: Nest mounts it with `app.use`, like the app's own
    // middleware. The module's default ({ path: '*', method: ALL }) becomes an
    // `app.all` route, and Express then reports `/{*path}` as the matched
    // route of every request nothing else matched — the metrics' `unmatched`
    // label (metrics.middleware.ts) would be lost
    forRoutes: ['*'],
  };
};

let appLoggerParams: Params | undefined;

/** The parameters of the application's logger, built once from the environment */
export const getLoggerParams = (): Params => (appLoggerParams ??= createLoggerParams());

/**
 * A Nest LoggerService on the same pino instance, usable before the Nest
 * application exists (the bootstrap lines, configuration errors); inside a
 * request it writes through the request's child logger like the injected one
 */
export const createNestLogger = (params: Params): LoggerService =>
  new PinoNestLogger(new PinoLogger(params), params);
