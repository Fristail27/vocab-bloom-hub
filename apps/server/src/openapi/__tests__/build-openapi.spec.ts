import { describe, expect, it } from '@jest/globals';
import type { OpenAPIObject } from '@nestjs/swagger';
import {
  attachResponseSchemas,
  filterPublicDocument,
  PUBLIC_SCHEMAS,
  serializeDocument,
} from '../build-openapi';
import { PUBLIC_RESPONSES } from '../public-responses';

const document: OpenAPIObject = {
  openapi: '3.0.0',
  info: { title: 'VocabBloom API', version: '0.0.1' },
  paths: {
    '/api/v1/words': {
      get: {
        parameters: [{ name: 'part_of_speech', in: 'query', schema: { $ref: '#/components/schemas/Filters' } }],
        responses: { '200': { description: '' } },
      },
    },
    '/api/v1/search': {
      post: {
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SearchV1ReqDTO' } } },
        },
        responses: { '200': { description: '' } },
      },
    },
    '/api/en/add/{entryType}': {
      post: {
        requestBody: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AddWordReqDTO' } } },
        },
        responses: { '201': { description: '' } },
      },
    },
    '/api/auth/login': { post: { responses: { '201': { description: '' } } } },
  },
  components: {
    securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
    schemas: {
      Filters: { type: 'object', properties: { nested: { $ref: '#/components/schemas/Nested' } } },
      Nested: { type: 'object', properties: { deeper: { items: { $ref: '#/components/schemas/Deeper' } } } },
      Deeper: { type: 'string' },
      SearchV1ReqDTO: { type: 'object' },
      AddWordReqDTO: { type: 'object', properties: { meanings: { $ref: '#/components/schemas/AdminOnly' } } },
      AdminOnly: { type: 'object' },
    },
  },
};

describe('public OpenAPI document (issue #273)', () => {
  it('keeps the /api/v1 paths and the schemas they reach, drops the rest and the security schemes', () => {
    const filtered = filterPublicDocument(document);

    expect(Object.keys(filtered.paths)).toEqual(['/api/v1/words', '/api/v1/search']);
    expect(Object.keys(filtered.components?.schemas ?? {}).sort()).toEqual([
      'Deeper',
      'Filters',
      'Nested',
      'SearchV1ReqDTO',
    ]);
    expect(filtered.components).not.toHaveProperty('securitySchemes');
    // the source document is left untouched
    expect(Object.keys(document.paths)).toHaveLength(4);
    expect(document.components?.securitySchemes).toBeDefined();
  });

  it('serializes as two-space JSON with one trailing newline', () => {
    const text = serializeDocument({ openapi: '3.0.0', info: { title: 't', version: '1' }, paths: {} });
    expect(text).toBe(
      '{\n  "openapi": "3.0.0",\n  "info": {\n    "title": "t",\n    "version": "1"\n  },\n  "paths": {}\n}\n',
    );
  });

  describe('attachResponseSchemas (issue #305)', () => {
    const schemas = {
      WordsResT: { type: 'object' },
      PublicApiErrorT: { type: 'object' },
    };
    const responses = {
      PublicWordsController_list: { type: 'WordsResT', errors: [400, 429] },
      PublicSearchController_search: { type: null, errors: [] },
    };
    const withIds: OpenAPIObject = {
      ...document,
      paths: {
        ...document.paths,
        '/api/v1/words': {
          get: { operationId: 'PublicWordsController_list', responses: { '200': { description: 'A page' } } },
        },
        '/api/v1/search': {
          post: { operationId: 'PublicSearchController_search', responses: { '200': { description: '' } } },
        },
      },
    };

    it('describes the success body and the error statuses of every public operation', () => {
      const patched = attachResponseSchemas(withIds, schemas, responses);
      expect(patched.paths['/api/v1/words'].get?.responses).toEqual({
        '200': {
          description: 'A page',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/WordsResT' } } },
        },
        '400': expect.objectContaining({
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PublicApiErrorT' } } },
        }),
        '429': expect.objectContaining({ description: expect.stringContaining('Rate limit') }),
      });
      // a null type documents a body outside the contract types
      expect(patched.paths['/api/v1/search'].post?.responses).toEqual({
        '200': {
          description: 'OK',
          content: { 'application/json': { schema: expect.objectContaining({ type: 'object' }) } },
        },
      });
      expect(patched.components?.schemas).toMatchObject(schemas);
      // admin routes and the source document are left alone
      expect(patched.paths['/api/auth/login']).toEqual(document.paths['/api/auth/login']);
      expect(withIds.paths['/api/v1/words'].get?.responses).toEqual({ '200': { description: 'A page' } });
    });

    it('refuses a public route without a registered response type or with an unknown one', () => {
      expect(() =>
        attachResponseSchemas(withIds, schemas, { PublicSearchController_search: { type: null, errors: [] } }),
      ).toThrow('No response type registered for GET /api/v1/words (PublicWordsController_list)');
      expect(() =>
        attachResponseSchemas(withIds, schemas, {
          ...responses,
          PublicWordsController_list: { type: 'Nope', errors: [] },
        }),
      ).toThrow('Response type "Nope" of PublicWordsController_list has no generated schema');
    });

    it('registers a generated schema for every response type in the map', () => {
      for (const [operationId, spec] of Object.entries(PUBLIC_RESPONSES)) {
        if (spec.type) expect(PUBLIC_SCHEMAS[spec.type] ?? operationId).not.toBe(operationId);
      }
      expect(PUBLIC_SCHEMAS.PublicApiErrorT).toBeDefined();
    });
  });
});
