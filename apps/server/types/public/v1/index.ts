import type { EnSearchWordT, EnWordT } from '../../dictionaries/en';
import type { ErrorResT } from '../../errors';

/**
 * Contract of the public read-only API, `/api/v1` (issue #271). The shapes
 * here are what consuming applications rely on: they change only with a
 * new version prefix. Errors reuse ErrorResT (`{ statusCode, message,
 * error: true }`), every response carries `X-API-Version: 1`.
 */
export const PUBLIC_API_V1_VERSION = '1';

// Lists travel in an envelope: the items under `data`, paging and counts under `meta`
export type PublicListResT<TItem, TMeta> = { data: TItem[]; meta: TMeta };

export type PublicSearchV1MetaT = { count: number };
export type PublicSearchV1ResT = PublicListResT<EnSearchWordT, PublicSearchV1MetaT>;

export type PublicSearchDetailedV1MetaT = { page: number; limit: number; has_more: boolean };
export type PublicSearchDetailedV1ResT = PublicListResT<EnWordT, PublicSearchDetailedV1MetaT>;

export type PublicApiErrorT = ErrorResT & { statusCode: number };
