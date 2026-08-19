import {
  ApiEndpointDocT,
  ApiEndpointKeyE,
  DOCUMENTED_ENDPOINTS,
  getEndpointBySlug,
  ParamControlE,
} from '../constants';
import { buildCurlSnippet, buildRequestBody, extractMeta, extractWords } from '../utils';

const searchEndpoint = DOCUMENTED_ENDPOINTS.find(({ key }) => key === ApiEndpointKeyE.search)!;
const detailedEndpoint = DOCUMENTED_ENDPOINTS.find(({ key }) => key === ApiEndpointKeyE.search_detailed)!;

const getEndpoint: ApiEndpointDocT = {
  ...searchEndpoint,
  method: 'GET',
  path: '/api/en/example',
  clientPath: '/en/example',
};

describe('buildRequestBody', () => {
  it('отправляет только заполненные фильтры', () => {
    const body = buildRequestBody(detailedEndpoint.params, {
      search: 'run',
      type: undefined,
      limit: 5,
      page: 1,
      with_meanings: true,
      with_translations: false,
      translation_languages: [],
    });

    expect(body).toEqual({ search: 'run', limit: 5, page: 1, with_meanings: true });
  });

  it('не пропускает значения параметров, которых нет в описании метода', () => {
    const body = buildRequestBody(searchEndpoint.params, { search: 'run', page: 3 });

    expect(body).toEqual({ search: 'run' });
  });
});

describe('buildCurlSnippet', () => {
  it('собирает POST-пример с телом запроса', () => {
    const snippet = buildCurlSnippet(detailedEndpoint, 'http://localhost:3010/api', {
      search: 'run',
      limit: 10,
    });

    expect(snippet).toContain(`curl -X POST 'http://localhost:3010/api/en/search/detailed'`);
    expect(snippet).toContain(`-H 'Content-Type: application/json'`);
    expect(snippet).toContain(`-d '{"search":"run","limit":10}'`);
  });

  it('не добавляет тело в GET-пример', () => {
    const snippet = buildCurlSnippet(getEndpoint, 'http://localhost:3010/api', { search: 'run' });

    expect(snippet).toContain(`curl -X GET 'http://localhost:3010/api/en/example'`);
    expect(snippet).not.toContain('-d ');
  });
});

describe('extractWords', () => {
  it('читает плоский список базового поиска', () => {
    expect(extractWords([{ id: 1, word: 'run' }])).toHaveLength(1);
  });

  it('читает items из постраничного ответа', () => {
    const words = extractWords({ items: [{ id: 1, word: 'run' }], page: 1, limit: 10, has_more: false });

    expect(words).toHaveLength(1);
  });

  it('возвращает null для ответа без списка слов', () => {
    expect(extractWords({ isValid: true })).toBeNull();
  });
});

describe('extractMeta', () => {
  it('собирает примитивные поля ответа и пропускает список', () => {
    const meta = extractMeta({ items: [{ id: 1, word: 'run' }], page: 2, limit: 10, has_more: true });

    expect(meta).toEqual([
      { key: 'page', value: '2' },
      { key: 'limit', value: '10' },
      { key: 'has_more', value: 'true' },
    ]);
  });
});

describe('DOCUMENTED_ENDPOINTS', () => {
  it('описывает все фильтры детального поиска', () => {
    expect(detailedEndpoint.params.map(({ name }) => name)).toEqual([
      'search',
      'type',
      'limit',
      'page',
      'with_meanings',
      'with_translations',
      'translation_languages',
    ]);
  });

  it('перечисляет варианты enum-параметров', () => {
    const type = detailedEndpoint.params.find(({ name }) => name === 'type');

    expect(type?.control).toBe(ParamControlE.enum);
    expect(type?.options).toEqual(['word', 'grammar_pattern', 'phrase']);
  });

  it('находит метод по сегменту маршрута', () => {
    expect(getEndpointBySlug('search-detailed')).toBe(detailedEndpoint);
    expect(getEndpointBySlug('unknown')).toBeUndefined();
  });
});
