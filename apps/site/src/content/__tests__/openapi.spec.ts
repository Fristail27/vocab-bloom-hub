import {
  buildCurlExample,
  describeType,
  endpointSlug,
  listEndpoints,
  OpenApiSpecT,
  sampleBody,
} from '../openapi';

const spec: OpenApiSpecT = {
  openapi: '3.0.0',
  info: { title: 'T', version: '1' },
  paths: {
    '/api/v1/search': {
      post: {
        operationId: 'search',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SearchDTO' } } },
        },
        responses: { '200': { description: 'OK' } },
      },
    },
    '/api/v1/words/{word}/meanings': {
      get: {
        operationId: 'meanings',
        parameters: [{ name: 'word', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' } },
      },
    },
  },
  components: {
    schemas: {
      SearchDTO: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          type: { type: 'string', enum: ['word', 'phrase'] },
          limit: { type: 'integer', minimum: 1, default: 10 },
        },
        required: ['search'],
      },
      LevelE: { type: 'string', enum: ['A1', 'A2'] },
    },
  },
};

describe('the public OpenAPI document as the reference reads it', () => {
  it('lists the operations in document order with an anchor per operation', () => {
    expect(listEndpoints(spec).map((e) => [e.method, e.slug])).toEqual([
      ['POST', 'post-search'],
      ['GET', 'get-words-word-meanings'],
    ]);
    expect(endpointSlug('get', '/api/v1/')).toBe('get-root');
  });

  it('labels a type the way it is read: refs, arrays, enums, nullability', () => {
    expect(describeType({ type: 'string' })).toEqual({ text: 'string' });
    expect(describeType({ $ref: '#/components/schemas/EnWordT' })).toEqual({ text: 'EnWordT', ref: 'EnWordT' });
    expect(describeType({ type: 'array', items: { $ref: '#/components/schemas/EnWordT' } })).toEqual({
      text: 'EnWordT[]',
      ref: 'EnWordT',
    });
    expect(describeType({ allOf: [{ $ref: '#/components/schemas/LevelE' }], nullable: true })).toEqual({
      text: 'LevelE | null',
      ref: 'LevelE',
    });
    expect(describeType({ type: 'string', nullable: true })).toEqual({ text: 'string | null' });
    expect(describeType({ type: 'array', items: { type: 'string', enum: ['a', 'b'] } })).toEqual({
      text: 'string[]',
      enumValues: ['a', 'b'],
    });
  });

  it('builds a body of the required fields only, with sample values', () => {
    expect(sampleBody(spec.components.schemas.SearchDTO, spec)).toEqual({ search: 'run' });
  });

  it('builds a runnable curl line: path params filled in, JSON body for a POST', () => {
    const [search, meanings] = listEndpoints(spec);
    expect(buildCurlExample(meanings, 'https://x.example/api', spec)).toBe(
      "curl 'https://x.example/api/v1/words/run/meanings'",
    );
    expect(buildCurlExample(search, 'https://x.example/api', spec)).toBe(
      "curl -X POST 'https://x.example/api/v1/search' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"search\":\"run\"}'",
    );
  });
});
