import { config } from 'dotenv';
import * as path from 'path';
// The env must be loaded before any entity import: column types are resolved
// inside entity decorators at import time (see checkIsPostgres)
config({ path: path.resolve(__dirname, '../../../../.env') });

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL must be set to run migration commands — migrations target Postgres only, ' +
      'the SQLite dev fallback stays on synchronize.',
  );
}

import { DataSource } from 'typeorm';
import { DB_ENTITIES } from './typeorm-options';
import { migrations } from './migrations';

// CLI-only DataSource for the typeorm migration commands (yarn migration:*).
// The running server configures its own connection in buildTypeOrmOptions.
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: DB_ENTITIES,
  migrations,
});
