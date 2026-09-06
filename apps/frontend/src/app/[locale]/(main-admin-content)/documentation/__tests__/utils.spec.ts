import {
  ApiEndpointDocT,
  ApiEndpointKeyE,
  DOCUMENTED_ENDPOINTS,
  getEndpointBySlug,
  ParamControlE,
} from '../constants';
import {
  buildCurlSnippet,
  buildQueryString,
  buildRequestBody,
  extractMeta,
  extractWords,
  resolveClientPath,
} from '../utils';

const searchEndpoint = DOCUMENTED_ENDPOINTS.find(({ key }) => key === ApiEndpointKeyE.search)!;
const detailedEndpoint = DOCUMENTED_ENDPOINTS.find(({ key }) => key === ApiEndpointKeyE.search_detailed)!;
const wordEndpoint = DOCUMENTED_ENDPOINTS.find(({ key }) => key === ApiEndpointKeyE.word)!;
const wordsEndpoint = DOCUMENTED_ENDPOINTS.find(({ key }) => key === ApiEndpointKeyE.words)!;

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

  it('разбивает текстовый список на массив строк (batch, issue #397)', () => {
    const batchEndpoint = DOCUMENTED_ENDPOINTS.find(({ key }) => key === ApiEndpointKeyE.words_batch)!;

    expect(buildRequestBody(batchEndpoint.params, { words: ' run, ran ,put up with,\n' })).toEqual({
      words: ['run', 'ran', 'put up with'],
    });
    expect(buildRequestBody(batchEndpoint.params, { words: ' , ' })).toEqual({});
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

    expect(snippet).toContain(`curl -X POST 'http://localhost:3010/api/v1/search/detailed'`);
    expect(snippet).toContain(`-H 'Content-Type: application/json'`);
    expect(snippet).toContain(`-d '{"search":"run","limit":10}'`);
  });

  it('переносит параметры GET-примера в строку запроса, а не в тело', () => {
    const snippet = buildCurlSnippet(getEndpoint, 'http://localhost:3010/api', { search: 'run' });

    expect(snippet).toBe(`curl -X GET 'http://localhost:3010/api/en/example?search=run'`);
  });

  it('подставляет path-параметры и повторяет ключ для списков (issue #272)', () => {
    expect(buildCurlSnippet(wordEndpoint, 'http://localhost:3010/api', { word: 'put up with' })).toBe(
      `curl -X GET 'http://localhost:3010/api/v1/words/put%20up%20with'`,
    );
    expect(
      buildCurlSnippet(wordsEndpoint, 'http://localhost:3010/api', {
        word_level: ['B1', 'B2'],
        form_of_word: ['base_form'],
        limit: 20,
      }),
    ).toBe(
      `curl -X GET 'http://localhost:3010/api/v1/words?word_level=B1&word_level=B2&form_of_word=base_form&limit=20'`,
    );
  });
});

describe('resolveClientPath', () => {
  it('вырезает path-параметры из остальных значений', () => {
    expect(resolveClientPath(wordEndpoint, { word: 'Run', language: ['ru'] })).toEqual({
      path: '/v1/words/Run',
      rest: { language: ['ru'] },
    });
    expect(buildQueryString({})).toBe('');
  });
});

describe('extractWords', () => {
  it('не принимает голый список: у ответов v1 всегда есть конверт', () => {
    expect(extractWords([{ id: 1, word: 'run' }])).toBeNull();
  });

  it('читает data из конверта v1', () => {
    const words = extractWords({
      data: [{ id: 1, word: 'run' }],
      meta: { page: 1, limit: 10, has_more: false },
    });

    expect(words).toHaveLength(1);
  });

  it('читает одну запись из конверта { data } (issue #272)', () => {
    expect(extractWords({ data: { id: 1, word: 'run', part_of_speech: 'verb' } })).toEqual([
      { id: 1, word: 'run', part_of_speech: 'verb' },
    ]);
  });

  it('возвращает null для ответа без списка слов', () => {
    expect(extractWords({ isValid: true })).toBeNull();
    // meanings, translations and meta have no words table
    expect(extractWords({ data: [{ id: 1, title: 'to move fast', word_id: 2 }], meta: {} })).toBeNull();
    expect(extractWords({ data: { short_translations: [], meaning_translations: [] } })).toBeNull();
    expect(extractWords({ data: { api_version: '1', counts: {} } })).toBeNull();
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
    // the bare slug is the GET form; the POST form has its own (issue #396)
    expect(getEndpointBySlug('search-detailed')?.key).toBe(ApiEndpointKeyE.search_detailed_get);
    expect(getEndpointBySlug('search-detailed-post')).toBe(detailedEndpoint);
    expect(getEndpointBySlug('word-by-id')?.key).toBe(ApiEndpointKeyE.word_by_id);
    expect(getEndpointBySlug('unknown')).toBeUndefined();
  });

  it('описывает все публичные методы v1 с уникальными сегментами (issue #272)', () => {
    // the full operation list is checked against the committed OpenAPI spec
    // in contract.spec.ts (issue #349); here only the internal consistency
    const slugs = DOCUMENTED_ENDPOINTS.map(({ slug }) => slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    // every {placeholder} of a path is a documented path param
    DOCUMENTED_ENDPOINTS.forEach((endpoint) => {
      const placeholders = [...endpoint.clientPath.matchAll(/\{(\w+)\}/g)].map(([, name]) => name);
      expect(endpoint.params.filter((p) => p.inPath).map((p) => p.name)).toEqual(placeholders);
    });
  });

  it('описывает фильтры списка и курсорную пагинацию', () => {
    expect(wordsEndpoint.params.map(({ name }) => name)).toEqual([
      'search',
      'is_obsolete',
      'part_of_speech',
      'word_level',
      'language_register',
      'category',
      'area_variant',
      'form_of_word',
      'cursor',
      'limit',
      'with_meanings',
      'with_translations',
    ]);
    expect(wordsEndpoint.params.find(({ name }) => name === 'form_of_word')?.defaultValue).toEqual([
      'base_form',
    ]);
  });
});
