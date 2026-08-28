import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';
import { CACHE_CONTROL_NO_STORE } from '../../core/utils/http-cache';

// A request that matched no route gets one label value instead of its
// path: paths are unbounded (every misspelled URL) and would blow the
// series up; route templates (/api/v1/words/:word) are finite
export const UNMATCHED_ROUTE = 'unmatched';

type RoutedRequestT = Request & { route?: { path?: string }; baseUrl?: string };

/** The Express route template that answered, joined with the mount path of its router */
export const routeTemplate = (req: RoutedRequestT): string => {
  const path = req.route?.path;
  if (typeof path !== 'string') return UNMATCHED_ROUTE;
  return `${req.baseUrl ?? ''}${path}` || '/';
};

/**
 * Counts and times every request, 404s included: registered before routing
 * and measured on the response's `finish`, so a request that never reached
 * a controller (a disabled surface, a wrong URL) still shows up in the error
 * rate. The metrics endpoint itself is left out.
 */
export const httpMetricsMiddleware =
  (metrics: MetricsService, metricsPath: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (req.path === metricsPath) return next();
    const startedAt = process.hrtime.bigint();
    metrics.httpRequestsInFlight.inc();
    res.once('finish', () => {
      metrics.httpRequestsInFlight.dec();
      const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      metrics.observeRequest(req.method, routeTemplate(req), res.statusCode, seconds);
    });
    next();
  };

/** GET <METRICS_PATH>: the Prometheus exposition of the registry */
export const metricsEndpoint =
  (metrics: MetricsService) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    metrics.render().then(
      ({ body, contentType }) => {
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', CACHE_CONTROL_NO_STORE);
        res.send(body);
      },
      (error: unknown) => next(error),
    );
  };
