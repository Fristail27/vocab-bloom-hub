import type { IndexOptions } from 'typeorm';

/**
 * `synchronize: false` keeps schema sync and migration:generate away from an
 * index that a decorator cannot express (a collation, a GIN over an array):
 * TypeORM neither creates nor drops it, the migration that declares it owns
 * it. TypeORM reads the flag at runtime (IndexMetadataArgs.synchronize) but
 * leaves it out of the decorator's typing.
 */
export const MANUALLY_MANAGED_INDEX = { synchronize: false } as IndexOptions;
