import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { getVersion } from '../../configuration';
import { isPublicApiPath, PUBLIC_API_PREFIX, PUBLIC_API_VERSION } from '../core/utils/public-api';

export const PUBLIC_OPENAPI_TAG = 'Public API v1';

/** The whole API, admin surface included: what the Swagger UI at /api shows in development */
export const buildAdminDocument = (app: INestApplication): OpenAPIObject => {
  const config = new DocumentBuilder()
    .setTitle('VocabBloom API')
    .setDescription('API documentation for VocabBloom backend')
    .setVersion(getVersion())
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
};

// Every `$ref` reachable from a value, recursively
const collectRefs = (value: unknown, refs: Set<string>): void => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectRefs(item, refs));
  } else if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (key === '$ref' && typeof nested === 'string') refs.add(nested);
      else collectRefs(nested, refs);
    }
  }
};

const SCHEMA_REF_PREFIX = '#/components/schemas/';

/**
 * Keeps only the public prefix of a document: the `/api/v1` paths and the
 * component schemas they (transitively) reference. Security schemes are
 * dropped — nothing under the prefix needs a login.
 */
export const filterPublicDocument = (document: OpenAPIObject): OpenAPIObject => {
  const paths = Object.fromEntries(
    Object.entries(document.paths ?? {}).filter(([path]) => isPublicApiPath(path)),
  );
  const allSchemas = document.components?.schemas ?? {};

  const wanted = new Set<string>();
  const pending: unknown[] = [paths];
  while (pending.length > 0) {
    const refs = new Set<string>();
    collectRefs(pending.pop(), refs);
    for (const ref of refs) {
      const name = ref.startsWith(SCHEMA_REF_PREFIX) ? ref.slice(SCHEMA_REF_PREFIX.length) : null;
      if (name && !wanted.has(name) && allSchemas[name]) {
        wanted.add(name);
        pending.push(allSchemas[name]);
      }
    }
  }

  const schemas = Object.fromEntries(Object.entries(allSchemas).filter(([name]) => wanted.has(name)));
  const { securitySchemes: _securitySchemes, ...components } = document.components ?? {};
  return {
    ...document,
    paths,
    components: { ...components, schemas },
  };
};

/**
 * The public contract (issue #273): the `/api/v1` routes of the running
 * application, as consumers, SDK generators and the docs site read it.
 * Served at GET /api/v1/openapi.json and written to openapi/public-v1.json
 * by `yarn workspace server openapi:generate`.
 */
export const buildPublicDocument = (app: INestApplication): OpenAPIObject => {
  const config = new DocumentBuilder()
    .setTitle('VocabBloom Public API')
    .setDescription(
      `Read-only dictionary API under ${PUBLIC_API_PREFIX} (contract version ${PUBLIC_API_VERSION}): ` +
        'no authentication, every answer in a { data, meta } envelope, errors as ' +
        '{ statusCode, message, error: true }, X-API-Version on every response. ' +
        'Successful GET answers carry ETag, Last-Modified and Cache-Control. ' +
        'See docs/api.md in the repository.',
    )
    .setVersion(getVersion())
    .addTag(PUBLIC_OPENAPI_TAG, 'Read-only dictionary endpoints for consuming applications')
    .build();
  return filterPublicDocument(SwaggerModule.createDocument(app, config));
};

/** The exact bytes of the committed spec: two-space JSON with a trailing newline */
export const serializeDocument = (document: OpenAPIObject): string => `${JSON.stringify(document, null, 2)}\n`;
