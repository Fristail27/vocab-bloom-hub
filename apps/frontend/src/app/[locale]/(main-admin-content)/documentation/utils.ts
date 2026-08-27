import { EnWordT, PublicListResT } from 'server/types';
import { ApiEndpointDocT, ApiParamDocT, ParamControlE } from './constants';

export type ParamValuesT = Record<string, unknown>;
// The basic search answers without meanings and short translations, the detailed one with them
export type ResponseWordT = Partial<EnWordT> & Pick<EnWordT, 'id' | 'word'>;
export type ResponseMetaT = { key: string; value: string };

// Only the filters the user actually filled in are sent: the server applies its
// own defaults and rejects unknown or empty fields (whitelist ValidationPipe)
export const buildRequestBody = (params: ApiParamDocT[], values: ParamValuesT): ParamValuesT => {
  const body: ParamValuesT = {};

  params.forEach(({ name, control }) => {
    const value = values[name];

    if (value === undefined || value === null || value === '') return;
    if (control === ParamControlE.boolean && value === false) return;
    if (Array.isArray(value) && value.length === 0) return;

    body[name] = value;
  });

  return body;
};

// Splits the filled values into the path segments (`/words/{word}`) and what
// travels as the body (POST) or the query string (GET)
export const resolveClientPath = (
  endpoint: ApiEndpointDocT,
  values: ParamValuesT,
): { path: string; rest: ParamValuesT } => {
  const rest = { ...values };
  let path = endpoint.clientPath;

  endpoint.params
    .filter((param) => param.inPath)
    .forEach(({ name }) => {
      path = path.replace(`{${name}}`, encodeURIComponent(String(values[name] ?? '')));
      delete rest[name];
    });

  return { path, rest };
};

// A list value becomes a repeated key (?a=1&a=2), which is how the server DTOs read filters
export const buildQueryString = (values: ParamValuesT): string => {
  const search = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    (Array.isArray(value) ? value : [value]).forEach((v) => search.append(key, String(v)));
  });

  const query = search.toString();

  return query ? `?${query}` : '';
};

export const buildCurlSnippet = (endpoint: ApiEndpointDocT, baseUrl: string, body: ParamValuesT): string => {
  const { path, rest } = resolveClientPath(endpoint, body);

  if (endpoint.method === 'GET') {
    return `curl -X GET '${baseUrl}${path}${buildQueryString(rest)}'`;
  }

  return [
    `curl -X ${endpoint.method} '${baseUrl}${path}'`,
    `  -H 'Content-Type: application/json'`,
    `  -d '${JSON.stringify(rest)}'`,
  ].join(' \\\n');
};

const isWordLike = (value: unknown): value is ResponseWordT =>
  !!value &&
  typeof value === 'object' &&
  'id' in value &&
  typeof (value as { word?: unknown }).word === 'string';

// Word lists (the search and list endpoints, a headword's entries or forms)
// and single entries (`{ data: EnWordT }`) have a table representation; a
// bare list (the deprecated aliases) is accepted too. Anything else has none
export const extractWords = (response: unknown): ResponseWordT[] | null => {
  if (Array.isArray(response)) return response as ResponseWordT[];

  const data = (response as Partial<PublicListResT<unknown, unknown>> | null)?.data;

  if (Array.isArray(data)) return data.every(isWordLike) ? data : null;

  return isWordLike(data) ? [data] : null;
};

// The scalar fields of `meta` (paging, counts); scalars at the top level are
// kept for responses without an envelope
export const extractMeta = (response: unknown): ResponseMetaT[] => {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return [];

  const source = (response as { meta?: unknown }).meta;
  const scalars = source && typeof source === 'object' && !Array.isArray(source) ? source : response;

  return Object.entries(scalars)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .map(([key, value]) => ({ key, value: String(value) }));
};
