/**
 * Writes the OpenAPI documents of the application (issue #273):
 *
 *   yarn workspace server openapi:generate   → openapi/public-v1.json (committed)
 *                                              openapi/admin.json     (ignored by git)
 *   yarn workspace server openapi:check      → fails when the committed public
 *                                              spec differs from the code
 *
 * The application is bootstrapped without listening, on an in-memory SQLite
 * database and with placeholder credentials, so the output depends on the
 * source code only — not on the developer's .env.
 */
process.env.DATABASE_URL = 'sqlite::memory:';
process.env.ADMIN_USERNAME ??= 'openapi';
process.env.ADMIN_PASSWORD ??= 'openapi';

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../modules/AppModule/app.module';
import { buildAdminDocument, buildPublicDocument, serializeDocument } from './build-openapi';

// apps/server/openapi, both from src/ (ts-node) and from dist/ (compiled)
export const OPENAPI_DIR = resolve(__dirname, '../../openapi');
export const PUBLIC_SPEC_FILE = resolve(OPENAPI_DIR, 'public-v1.json');
export const ADMIN_SPEC_FILE = resolve(OPENAPI_DIR, 'admin.json');

const main = async (): Promise<number> => {
  const check = process.argv.includes('--check');
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    const publicSpec = serializeDocument(buildPublicDocument(app));
    if (check) {
      let committed: string | null = null;
      try {
        committed = readFileSync(PUBLIC_SPEC_FILE, 'utf8');
      } catch {
        committed = null;
      }
      if (committed === publicSpec) {
        console.log(`${PUBLIC_SPEC_FILE} is up to date`);
        return 0;
      }
      console.error(
        committed === null
          ? `${PUBLIC_SPEC_FILE} is missing.`
          : `${PUBLIC_SPEC_FILE} is stale: the public API contract changed in the code.`,
      );
      console.error('Run `yarn workspace server openapi:generate` and commit the result.');
      return 1;
    }
    mkdirSync(OPENAPI_DIR, { recursive: true });
    writeFileSync(PUBLIC_SPEC_FILE, publicSpec);
    writeFileSync(ADMIN_SPEC_FILE, serializeDocument(buildAdminDocument(app)));
    console.log(`Wrote ${PUBLIC_SPEC_FILE} and ${ADMIN_SPEC_FILE}`);
    return 0;
  } finally {
    await app.close();
  }
};

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
}
