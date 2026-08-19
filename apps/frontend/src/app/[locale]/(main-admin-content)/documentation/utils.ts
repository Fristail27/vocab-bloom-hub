import { EnWordT, SearchDetailedItemsT } from 'server/types';
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

export const buildCurlSnippet = (endpoint: ApiEndpointDocT, baseUrl: string, body: ParamValuesT): string => {
  const lines = [`curl -X ${endpoint.method} '${baseUrl}${endpoint.clientPath}'`];

  if (endpoint.method !== 'GET') {
    lines.push(`  -H 'Content-Type: application/json'`);
    lines.push(`  -d '${JSON.stringify(body)}'`);
  }

  return lines.join(' \\\n');
};

// Both search endpoints answer with a word list, either bare or wrapped in a
// paginated envelope; anything else has no table representation
export const extractWords = (response: unknown): ResponseWordT[] | null => {
  if (Array.isArray(response)) return response as ResponseWordT[];

  const items = (response as SearchDetailedItemsT | null)?.items;

  return Array.isArray(items) ? items : null;
};

export const extractMeta = (response: unknown): ResponseMetaT[] => {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return [];

  return Object.entries(response)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .map(([key, value]) => ({ key, value: String(value) }));
};
