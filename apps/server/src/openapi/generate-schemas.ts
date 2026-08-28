/**
 * Build-time only (issue #305): reads `types/public/v1/index.ts` with
 * ts-json-schema-generator and writes the OpenAPI component schemas of the
 * public contract. The runtime never runs this — it reads the committed
 * result, openapi/public-v1.schemas.json, so the served document needs no
 * TypeScript sources or compiler.
 */
import { resolve } from 'node:path';
import { createGenerator } from 'ts-json-schema-generator';
import { SchemaMapT, toOpenApiSchemas } from './json-schema-to-openapi';

// apps/server is the working directory of the workspace scripts
export const PUBLIC_TYPES_FILE = resolve(process.cwd(), 'types/public/v1/index.ts');

export const generatePublicSchemas = (): SchemaMapT => {
  const generator = createGenerator({
    path: PUBLIC_TYPES_FILE,
    tsconfig: resolve(process.cwd(), 'tsconfig.json'),
    type: '*',
    expose: 'export',
    topRef: true,
    jsDoc: 'extended',
    skipTypeCheck: true,
  });
  return toOpenApiSchemas(generator.createSchema('*') as { definitions?: SchemaMapT });
};

/** The exact bytes of the committed schemas: two-space JSON with a trailing newline */
export const serializeSchemas = (schemas: SchemaMapT): string => `${JSON.stringify(schemas, null, 2)}\n`;
