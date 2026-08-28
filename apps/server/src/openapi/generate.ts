/**
 * Writes the OpenAPI documents of the application (issue #273):
 *
 *   yarn workspace server openapi:generate   → openapi/public-v1.json (committed)
 *                                              openapi/public-v1.schemas.json (committed,
 *                                              the response schemas of types/public/v1, #305)
 *                                              openapi/admin.json     (ignored by git)
 *   yarn workspace server openapi:check      → fails when the committed public
 *                                              spec or schemas differ from the code
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
import { generatePublicSchemas, serializeSchemas } from './generate-schemas';

// apps/server/openapi, both from src/ (ts-node) and from dist/ (compiled)
export const OPENAPI_DIR = resolve(__dirname, '../../openapi');
export const PUBLIC_SPEC_FILE = resolve(OPENAPI_DIR, 'public-v1.json');
export const PUBLIC_SCHEMAS_FILE = resolve(OPENAPI_DIR, 'public-v1.schemas.json');
export const ADMIN_SPEC_FILE = resolve(OPENAPI_DIR, 'admin.json');

const readOrNull = (file: string): string | null => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
};

const main = async (): Promise<number> => {
  const check = process.argv.includes('--check');
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    const schemas = generatePublicSchemas();
    const outputs: Array<[file: string, content: string]> = [
      [PUBLIC_SCHEMAS_FILE, serializeSchemas(schemas)],
      [PUBLIC_SPEC_FILE, serializeDocument(buildPublicDocument(app, schemas))],
    ];
    if (check) {
      const stale = outputs.filter(([file, content]) => readOrNull(file) !== content);
      if (stale.length === 0) {
        console.log(`${PUBLIC_SPEC_FILE} and ${PUBLIC_SCHEMAS_FILE} are up to date`);
        return 0;
      }
      for (const [file] of stale) {
        console.error(
          readOrNull(file) === null
            ? `${file} is missing.`
            : `${file} is stale: the public API contract changed in the code.`,
        );
      }
      console.error('Run `yarn workspace server openapi:generate` and commit the result.');
      return 1;
    }
    mkdirSync(OPENAPI_DIR, { recursive: true });
    for (const [file, content] of outputs) writeFileSync(file, content);
    writeFileSync(ADMIN_SPEC_FILE, serializeDocument(buildAdminDocument(app)));
    console.log(`Wrote ${PUBLIC_SPEC_FILE}, ${PUBLIC_SCHEMAS_FILE} and ${ADMIN_SPEC_FILE}`);
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
