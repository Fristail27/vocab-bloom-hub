import { NotFoundException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  API_VERSION_HEADER,
  getApiSurfaces,
  isAdminApiPath,
  isPublicApiPath,
  PUBLIC_API_VERSION,
  requestPath,
} from '../utils/public-api';
import { CACHE_CONTROL_NO_STORE } from '../utils/http-cache';

/**
 * Runs before routing on every request: stamps `X-API-Version` on the
 * public prefix (including its 4xx answers, which interceptors would miss)
 * and hides the surfaces the instance does not serve. A disabled surface
 * answers 404 as if the routes did not exist, so nothing leaks about them.
 * The admin prefixes get `Cache-Control: no-store` (issue #274).
 */
export const apiSurfaceMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const path = requestPath(req);
  const surfaces = getApiSurfaces();
  if (isPublicApiPath(path)) {
    res.setHeader(API_VERSION_HEADER, PUBLIC_API_VERSION);
    if (!surfaces.publicApi) return next(new NotFoundException());
  } else if (isAdminApiPath(path)) {
    // editing state and credentials: no cache anywhere may keep these answers
    res.setHeader('Cache-Control', CACHE_CONTROL_NO_STORE);
    if (!surfaces.adminApi) return next(new NotFoundException());
  }
  next();
};
