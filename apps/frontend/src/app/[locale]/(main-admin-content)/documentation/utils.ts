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

export const buildCurlSnippet = (endpoint: ApiEndpointDocT, baseUrl: string, body: ParamValuesT): string => {
  const lines = [`curl -X ${endpoint.method} '${baseUrl}${endpoint.clientPath}'`];

  if (endpoint.method !== 'GET') {
    lines.push(`  -H 'Content-Type: application/json'`);
    lines.push(`  -d '${JSON.stringify(body)}'`);
  }

  return lines.join(' \\\n');
};

// Public list endpoints answer with the v1 envelope `{ data, meta }`; a bare
// list (the deprecated aliases) is accepted too. Anything else has no table
// representation
export const extractWords = (response: unknown): ResponseWordT[] | null => {
  if (Array.isArray(response)) return response as ResponseWordT[];

  const data = (response as Partial<PublicListResT<ResponseWordT, unknown>> | null)?.data;

  return Array.isArray(data) ? data : null;
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
