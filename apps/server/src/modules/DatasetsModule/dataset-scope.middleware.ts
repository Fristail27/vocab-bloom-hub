import { BadRequestException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  DATASET_QUERY_PARAM,
  DATASET_TARGET_PATTERN,
  isDatasetScopedRoute,
} from '../../../core/constants/datasets';
import { ErrorCodes } from '../../../core/constants/error_codes';
import { withDatasetScope } from '../../core/utils/dataset-scope';
import { requestPath } from '../../core/utils/public-api';
import { isAdminRequest } from '../AuthModule/guards/admin.guard';
import { DatasetsService } from './datasets.service';

const API_PREFIX = '/api';

export const isDatasetScopedPath = (path: string): boolean =>
  path.startsWith(`${API_PREFIX}/`) && isDatasetScopedRoute(path.slice(API_PREFIX.length));

/** Takes `dataset` out of the query string: the DTOs of the routes do not know it, and refuse what they do not know */
const takeDatasetParam = (req: Request): string | null => {
  const mark = req.url.indexOf('?');
  if (mark < 0) return null;
  const path = req.url.slice(0, mark);
  const params = new URLSearchParams(req.url.slice(mark + 1));
  if (!params.has(DATASET_QUERY_PARAM)) return null;
  const named = params.get(DATASET_QUERY_PARAM) ?? '';
  params.delete(DATASET_QUERY_PARAM);
  const rest = params.toString();
  req.url = rest ? `${path}?${rest}` : path;
  return named;
};

/**
 * The dataset an admin request of the dictionary works on (issue #540):
 * `?dataset=<name>` on a route of `/api/en/*`, the active dataset without
 * it. A dataset that is not the active one is reached through the
 * connection DatasetsService keeps on its schema, and the request runs
 * inside a scope that carries it — the edit services take their
 * repositories from the scope. Runs after the switch gate: a switch of the
 * active dataset never happens between the choice of the connection and
 * its use. A request without the admin's token is left to the guard of its
 * route, which refuses it before anything is looked up.
 */
export const datasetScopeMiddleware =
  (datasets: DatasetsService) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!isDatasetScopedPath(requestPath(req))) return next();
    const named = takeDatasetParam(req);
    if (named === null || named === '' || !(await isAdminRequest(req))) return next();
    if (!DATASET_TARGET_PATTERN.test(named))
      return next(new BadRequestException(ErrorCodes.dataset_name_invalid));

    try {
      const dataset = await datasets.find(named);
      if (dataset.name === datasets.getActive().name) return next();
      const dataSource = await datasets.reader(dataset);
      // an edit of a dataset that is not served changes what the reads of every dataset answer
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.once('finish', () => {
          if (res.statusCode < 400) datasets.contentChanged(dataset);
        });
      }
      withDatasetScope({ dataset, dataSource }, () => next());
    } catch (error) {
      next(error);
    }
  };
