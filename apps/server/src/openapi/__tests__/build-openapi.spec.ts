import { describe, expect, it } from '@jest/globals';
import type { OpenAPIObject } from '@nestjs/swagger';
import { filterPublicDocument, serializeDocument } from '../build-openapi';

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
});
