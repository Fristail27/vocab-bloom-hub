import { ApiQuery } from '@nestjs/swagger';
import { DATASET_QUERY_PARAM } from '../../../core/constants/datasets';

/**
 * `?dataset=` of the admin routes of the dictionary (issue #540), as the
 * Swagger UI of the admin API shows it. The parameter is taken out of the
 * query string by `datasetScopeMiddleware` before a DTO sees it.
 */
export const ApiDatasetQuery = (): MethodDecorator & ClassDecorator =>
  ApiQuery({
    name: DATASET_QUERY_PARAM,
    required: false,
    type: String,
    description:
      'The dataset the request works on: an installed dataset of the instance. Without it, the active one.',
  });
