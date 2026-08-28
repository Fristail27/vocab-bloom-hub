import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { getVersion } from '../../configuration';
import { isPublicApiPath, PUBLIC_API_PREFIX, PUBLIC_API_VERSION } from '../core/utils/public-api';
import { COMPONENT_SCHEMAS_PREFIX, SchemaMapT } from './json-schema-to-openapi';
import {
  PUBLIC_ERROR_DESCRIPTIONS,
  PUBLIC_ERROR_SCHEMA,
  PUBLIC_RESPONSES,
  PublicResponseSpecT,
} from './public-responses';
import committedSchemas from '../../openapi/public-v1.schemas.json';

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

// Component schemas of the public contract, generated from types/public/v1
// by openapi:generate (issue #305) and committed next to the document
export const PUBLIC_SCHEMAS: SchemaMapT = committedSchemas as SchemaMapT;

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

type OperationT = {
  operationId?: string;
  responses?: Record<string, { description?: string; content?: unknown }>;
};

const schemaRef = (name: string) => ({ $ref: `${COMPONENT_SCHEMAS_PREFIX}${name}` });

const responsesOf = (operation: OperationT, spec: PublicResponseSpecT, schemas: SchemaMapT) => {
  const [successCode, success] = Object.entries(operation.responses ?? {}).find(([code]) =>
    code.startsWith('2'),
  ) ?? ['200', {}];
  const successSchema = spec.type
    ? schemaRef(spec.type)
    : { type: 'object', description: 'The OpenAPI 3 document' };
  const responses: Record<string, unknown> = {
    [successCode]: {
      description: success.description || 'OK',
      content: { 'application/json': { schema: successSchema } },
    },
  };
  for (const status of spec.errors) {
    responses[String(status)] = {
      description: PUBLIC_ERROR_DESCRIPTIONS[status] ?? 'Error',
      content: { 'application/json': { schema: schemaRef(PUBLIC_ERROR_SCHEMA) } },
    };
  }
  if (!schemas[PUBLIC_ERROR_SCHEMA])
    throw new Error(`Schema "${PUBLIC_ERROR_SCHEMA}" is missing from the generated schemas`);
  return responses;
};

/**
 * Adds the response schemas to every public operation (issue #305): the
 * success body from PUBLIC_RESPONSES and the generated schemas, the error
 * statuses in the PublicApiErrorT shape. Throws for a public route without
 * a registered response type, so the generator and the served document
 * fail loudly instead of publishing an untyped endpoint.
 */
export const attachResponseSchemas = (
  document: OpenAPIObject,
  schemas: SchemaMapT,
  responses: Record<string, PublicResponseSpecT> = PUBLIC_RESPONSES,
): OpenAPIObject => {
  const paths = Object.fromEntries(
    Object.entries(document.paths ?? {}).map(([path, item]) => {
      if (!isPublicApiPath(path)) return [path, item];
      const patched = { ...item } as Record<string, unknown>;
      for (const method of HTTP_METHODS) {
        const operation = patched[method] as OperationT | undefined;
        if (!operation) continue;
        const spec = operation.operationId ? responses[operation.operationId] : undefined;
        if (!spec) {
          throw new Error(
            `No response type registered for ${method.toUpperCase()} ${path} (${operation.operationId ?? 'no operationId'}); ` +
              'add it to src/openapi/public-responses.ts',
          );
        }
        if (spec.type && !schemas[spec.type]) {
          throw new Error(`Response type "${spec.type}" of ${operation.operationId} has no generated schema`);
        }
        patched[method] = { ...operation, responses: responsesOf(operation, spec, schemas) };
      }
      return [path, patched];
    }),
  );
  return {
    ...document,
    paths: paths as OpenAPIObject['paths'],
    components: {
      ...document.components,
      schemas: { ...document.components?.schemas, ...(schemas as OpenAPIObject['components']) },
    },
  } as OpenAPIObject;
};

/**
 * The public contract (issue #273): the `/api/v1` routes of the running
 * application, as consumers, SDK generators and the docs site read it.
 * Served at GET /api/v1/openapi.json and written to openapi/public-v1.json
 * by `yarn workspace server openapi:generate`. Response bodies are described
 * by the schemas generated from types/public/v1 (issue #305); the generator
 * passes a fresh set, the runtime uses the committed one.
 */
export const buildPublicDocument = (
  app: INestApplication,
  schemas: SchemaMapT = PUBLIC_SCHEMAS,
): OpenAPIObject => {
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
  return filterPublicDocument(attachResponseSchemas(SwaggerModule.createDocument(app, config), schemas));
};

/** The exact bytes of the committed spec: two-space JSON with a trailing newline */
export const serializeDocument = (document: OpenAPIObject): string => `${JSON.stringify(document, null, 2)}\n`;
