import { AvailableTranslationLanguagesE, EnEntryTypesE } from 'server/types';

// Endpoints open to any consumer of the dictionary; the auth routes are admin
// panel plumbing and stay out of the public documentation
export enum ApiEndpointKeyE {
  search = 'search',
  search_detailed = 'search_detailed',
}

export enum ParamControlE {
  text = 'text',
  number = 'number',
  boolean = 'boolean',
  enum = 'enum',
  multi_enum = 'multi_enum',
}

export type ApiParamDocT = {
  name: string;
  type: string;
  control: ParamControlE;
  required: boolean;
  defaultValue?: string | number | boolean;
  min?: number;
  max?: number;
  // Free-form limitation shown when there is no range or option list, e.g. a regexp
  constraints?: string;
  options?: string[];
};

export type ApiEndpointDocT = {
  key: ApiEndpointKeyE;
  // Segment under /documentation
  slug: string;
  method: 'GET' | 'POST';
  // Route as mounted on the server, shown in the docs header
  path: string;
  // Path relative to the API base url, used to run the live example
  clientPath: string;
  throttle?: { limit: number; seconds: number };
  params: ApiParamDocT[];
  responseType: string;
};

const SEARCH_TERM_PARAM: ApiParamDocT = {
  name: 'search',
  type: 'string',
  control: ParamControlE.text,
  required: true,
};

const ENTRY_TYPE_PARAM: ApiParamDocT = {
  name: 'type',
  type: 'EnEntryTypesE',
  control: ParamControlE.enum,
  required: false,
  options: Object.values(EnEntryTypesE),
};

export const DOCUMENTED_ENDPOINTS: ApiEndpointDocT[] = [
  {
    key: ApiEndpointKeyE.search,
    slug: 'search',
    method: 'POST',
    path: '/api/en/search/',
    clientPath: '/en/search',
    throttle: { limit: 30, seconds: 10 },
    responseType: 'EnSearchWordT[]',
    params: [
      SEARCH_TERM_PARAM,
      ENTRY_TYPE_PARAM,
      {
        name: 'limit',
        type: 'number',
        control: ParamControlE.number,
        required: false,
        defaultValue: 10,
        min: 1,
        max: 100,
      },
    ],
  },
  {
    key: ApiEndpointKeyE.search_detailed,
    slug: 'search-detailed',
    method: 'POST',
    path: '/api/en/search/detailed',
    clientPath: '/en/search/detailed',
    throttle: { limit: 30, seconds: 10 },
    responseType: 'SearchDetailedItemsT',
    params: [
      SEARCH_TERM_PARAM,
      ENTRY_TYPE_PARAM,
      {
        name: 'limit',
        type: 'number',
        control: ParamControlE.number,
        required: false,
        defaultValue: 10,
        min: 1,
        max: 20,
      },
      {
        name: 'page',
        type: 'number',
        control: ParamControlE.number,
        required: false,
        defaultValue: 1,
        min: 1,
        max: 20,
      },
      {
        name: 'with_meanings',
        type: 'boolean',
        control: ParamControlE.boolean,
        required: false,
        defaultValue: false,
      },
      {
        name: 'with_translations',
        type: 'boolean',
        control: ParamControlE.boolean,
        required: false,
        defaultValue: false,
      },
      {
        name: 'translation_languages',
        type: 'AvailableTranslationLanguagesE[]',
        control: ParamControlE.multi_enum,
        required: false,
        options: Object.values(AvailableTranslationLanguagesE),
      },
    ],
  },
];

export const getEndpointBySlug = (slug: string): ApiEndpointDocT | undefined =>
  DOCUMENTED_ENDPOINTS.find((endpoint) => endpoint.slug === slug);
