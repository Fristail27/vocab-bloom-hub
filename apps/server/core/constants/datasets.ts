// Several dictionary datasets per instance (issue #527): each dataset keeps
// its own set of dictionary tables in a Postgres schema of its own, one of
// them is active and served. The dataset the instance was born with lives in
// `public` and is called `default`.
export const DEFAULT_DATASET_NAME = 'default';
export const DEFAULT_DATASET_SCHEMA = 'public';
// what the project's own, LLM-generated dataset is called as a source
export const OWN_DATASET_SOURCE = 'vocab-bloom-hub';
// a dataset's name is also the tail of its schema name, so it is kept to
// what an unquoted Postgres identifier takes: lower-case latin, digits, `_`
export const DATASET_NAME_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
/** Maximum length of the registry's version label, including versions chosen by an owner. */
export const DATASET_VERSION_MAX_LENGTH = 64;
/** What an import may name as its target: a dataset's name, `default` included */
export const DATASET_TARGET_PATTERN = /^(default|[a-z][a-z0-9_]{1,39})$/;
export const DATASET_SCHEMA_PREFIX = 'ds_';
/** The settings field that names the active dataset */
export const ACTIVE_DATASET_SETTINGS_FIELD = 'active_dataset';
/**
 * The settings field that keeps when a dataset was last deleted (issue #528):
 * a deleted dataset leaves no row in the registry, and what is read from
 * every dataset at once changed with it
 */
export const DATASET_REMOVED_AT_SETTINGS_FIELD = 'dataset_removed_at';

export const datasetSchemaOf = (name: string): string =>
  name === DEFAULT_DATASET_NAME ? DEFAULT_DATASET_SCHEMA : `${DATASET_SCHEMA_PREFIX}${name}`;

/**
 * The query parameter that names the dataset an admin request of the
 * dictionary works on (issue #540); without it, the active one
 */
export const DATASET_QUERY_PARAM = 'dataset';

// the datasets themselves, the import (which names its target in its own
// request) and the journal of the instance are no part of one dataset
const OUTSIDE_A_DATASET = /^\/en\/(datasets|dictionary\/import|audit)(\/|$)/;

/**
 * Whether a route of the API — its path after the `/api` prefix, e.g.
 * `/en/words` — works on the dataset a request names (issue #540): the admin
 * routes of the dictionary. The admin UI sends the dataset of its switch to
 * these routes and to no other.
 */
export const isDatasetScopedRoute = (route: string): boolean =>
  route.startsWith('/en/') && !OUTSIDE_A_DATASET.test(route);
