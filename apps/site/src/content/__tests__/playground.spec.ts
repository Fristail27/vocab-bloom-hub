import { listEndpoints, OpenApiSpecT } from '../openapi';
import {
  curlOf,
  FieldControlE,
  initialValues,
  missingRequired,
  planRequest,
  playgroundEndpoint,
} from '../playground';

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
        responses: {},
      },
    },
    '/api/v1/words/{word}/translations': {
      get: {
        operationId: 'translations',
        parameters: [
          { name: 'word', in: 'path', required: true, schema: { type: 'string' } },
          {
            name: 'language',
            in: 'query',
            schema: { type: 'array', items: { type: 'string', enum: ['ru', 'de'] } },
          },
          { name: 'with_meanings', in: 'query', schema: { type: 'boolean', default: false } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: {},
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
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
        },
        required: ['search'],
      },
    },
  },
};

const [search, translations] = listEndpoints(spec).map((endpoint) => playgroundEndpoint(endpoint, spec));

describe('the playground form, derived from the OpenAPI document', () => {
  it('turns parameters and body fields into controls', () => {
    expect(translations.fields.map((f) => [f.name, f.in, f.control, f.required])).toEqual([
      ['word', 'path', FieldControlE.text, true],
      ['language', 'query', FieldControlE.multi, false],
      ['with_meanings', 'query', FieldControlE.boolean, false],
      ['limit', 'query', FieldControlE.number, false],
    ]);
    expect(translations.fields[1].options).toEqual(['ru', 'de']);
    expect(search.fields.map((f) => [f.name, f.in, f.control, f.required])).toEqual([
      ['search', 'body', FieldControlE.text, true],
      ['type', 'body', FieldControlE.select, false],
      ['limit', 'body', FieldControlE.number, false],
    ]);
  });

  it('starts from the document defaults, blank otherwise', () => {
    expect(initialValues(translations.fields)).toEqual({
      word: '',
      language: [],
      with_meanings: false,
      limit: 20,
    });
  });

  it('plans a GET with the path filled in and only the changed filters in the query', () => {
    const plan = planRequest(translations, {
      word: 'give up',
      language: ['ru', 'de'],
      with_meanings: true,
      limit: 20,
    });
    expect(plan).toEqual({
      method: 'GET',
      path: '/v1/words/give%20up/translations',
      query: '?language=ru&language=de&with_meanings=true',
      body: undefined,
    });
    expect(curlOf(plan, 'https://x.example/api')).toBe(
      "curl 'https://x.example/api/v1/words/give%20up/translations?language=ru&language=de&with_meanings=true'",
    );
  });

  it('plans a POST with a body of the filled-in fields, numbers as numbers', () => {
    const plan = planRequest(search, { search: 'run', type: '', limit: '5' });
    expect(plan).toEqual({ method: 'POST', path: '/v1/search', query: '', body: { search: 'run', limit: 5 } });
    expect(curlOf(plan, 'http://localhost:3020/api')).toBe(
      'curl -X POST \'http://localhost:3020/api/v1/search\' \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{"search":"run","limit":5}\'',
    );
  });

  it('names the required fields still blank', () => {
    expect(missingRequired(search, { search: '' })).toEqual(['search']);
    expect(missingRequired(search, { search: 'run' })).toEqual([]);
  });
});
