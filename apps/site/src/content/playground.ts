import { EndpointT, jsonSchemaOf, OpenApiSpecT, refName, SchemaT } from './openapi';

export enum FieldControlE {
  text = 'text',
  number = 'number',
  boolean = 'boolean',
  select = 'select',
  multi = 'multi',
  // a free list of strings, typed as one comma-separated text (the batch lookup)
  list = 'list',
}

export type FieldT = {
  name: string;
  in: 'path' | 'query' | 'body';
  control: FieldControlE;
  required: boolean;
  description?: string;
  options?: string[];
  defaultValue?: unknown;
  min?: number;
  max?: number;
};

/** What the playground needs of an endpoint: serialisable, computed at build time from the document */
export type PlaygroundEndpointT = {
  slug: string;
  method: 'GET' | 'POST';
  path: string;
  summary?: string;
  fields: FieldT[];
};

export type ValuesT = Record<string, unknown>;

const resolve = (schema: SchemaT, spec: OpenApiSpecT): SchemaT =>
  schema.$ref ? spec.components.schemas[refName(schema.$ref)] : schema;

const controlFor = (schema: SchemaT, spec: OpenApiSpecT): { control: FieldControlE; options?: string[] } => {
  const resolved = resolve(schema.allOf?.[0]?.$ref ? schema.allOf[0] : schema, spec);
  if (resolved.type === 'array') {
    const item = resolve(resolved.items ?? {}, spec);

    return item.enum ? { control: FieldControlE.multi, options: item.enum } : { control: FieldControlE.list };
  }
  if (resolved.enum) return { control: FieldControlE.select, options: resolved.enum };
  if (resolved.type === 'integer' || resolved.type === 'number') return { control: FieldControlE.number };
  if (resolved.type === 'boolean') return { control: FieldControlE.boolean };

  return { control: FieldControlE.text };
};

const fieldOf = (
  name: string,
  where: FieldT['in'],
  schema: SchemaT,
  required: boolean,
  description: string | undefined,
  spec: OpenApiSpecT,
): FieldT => ({
  name,
  in: where,
  required,
  description: description ?? schema.description,
  defaultValue: schema.default,
  min: schema.minimum,
  max: schema.maximum,
  ...controlFor(schema, spec),
});

/** The form of an endpoint: its path and query parameters, then the fields of its JSON body */
export const playgroundEndpoint = (endpoint: EndpointT, spec: OpenApiSpecT): PlaygroundEndpointT => {
  const { operation } = endpoint;
  const fields = (operation.parameters ?? [])
    .filter((param) => param.in === 'path' || param.in === 'query')
    .map((param) =>
      fieldOf(
        param.name,
        param.in as 'path' | 'query',
        param.schema,
        !!param.required,
        param.description,
        spec,
      ),
    );

  const bodySchema = jsonSchemaOf(operation.requestBody?.content);
  if (bodySchema) {
    const body = resolve(bodySchema, spec);
    const required = new Set(body.required ?? []);
    for (const [name, property] of Object.entries(body.properties ?? {})) {
      fields.push(fieldOf(name, 'body', property, required.has(name), undefined, spec));
    }
  }

  return {
    slug: endpoint.slug,
    method: endpoint.method === 'POST' ? 'POST' : 'GET',
    path: endpoint.path,
    summary: operation.summary,
    fields,
  };
};

/** Empty text, unchecked booleans, the document's defaults where it has them */
export const initialValues = (fields: FieldT[]): ValuesT =>
  Object.fromEntries(
    fields.map((field) => [
      field.name,
      field.defaultValue ??
        (field.control === FieldControlE.boolean ? false : field.control === FieldControlE.multi ? [] : ''),
    ]),
  );

// "run, ran, put up with" → ['run', 'ran', 'put up with']
const splitList = (value: unknown): string[] =>
  (Array.isArray(value) ? value.map(String) : String(value ?? '').split(/[,\n]/))
    .map((item) => item.trim())
    .filter((item) => item !== '');

const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

export type RequestPlanT = {
  method: 'GET' | 'POST';
  /** Path with the path parameters filled in, relative to the API base (`/v1/words/run`) */
  path: string;
  /** `?a=1&a=2` for a GET, empty otherwise */
  query: string;
  /** The JSON body of a POST; undefined for a GET */
  body?: Record<string, unknown>;
};

/**
 * The request the filled-in form describes. Blank values and unchanged
 * defaults are left out: the server applies its own defaults and rejects
 * unknown or empty fields (whitelist validation)
 */
export const planRequest = (endpoint: PlaygroundEndpointT, values: ValuesT): RequestPlanT => {
  let path = endpoint.path.replace(/^\/api/, '');
  const search = new URLSearchParams();
  const body: Record<string, unknown> = {};

  for (const field of endpoint.fields) {
    const value = field.control === FieldControlE.list ? splitList(values[field.name]) : values[field.name];
    if (field.in === 'path') {
      path = path.replace(`{${field.name}}`, encodeURIComponent(String(value ?? '')));
      continue;
    }
    if (isBlank(value)) continue;
    if (field.control === FieldControlE.boolean && value === false) continue;
    if (field.defaultValue !== undefined && JSON.stringify(value) === JSON.stringify(field.defaultValue))
      continue;

    if (field.in === 'query') {
      for (const item of Array.isArray(value) ? value : [value]) search.append(field.name, String(item));
    } else {
      body[field.name] = field.control === FieldControlE.number ? Number(value) : value;
    }
  }

  const query = search.toString();

  return {
    method: endpoint.method,
    path,
    query: query ? `?${query}` : '',
    body: endpoint.method === 'POST' ? body : undefined,
  };
};

export const missingRequired = (endpoint: PlaygroundEndpointT, values: ValuesT): string[] =>
  endpoint.fields.filter((field) => field.required && isBlank(values[field.name])).map((field) => field.name);

/** The same request as a shell line */
export const curlOf = (plan: RequestPlanT, apiBase: string): string => {
  const url = `${apiBase}${plan.path}${plan.query}`;
  if (plan.method === 'GET') return `curl '${url}'`;

  return [
    `curl -X POST '${url}'`,
    `  -H 'Content-Type: application/json'`,
    `  -d '${JSON.stringify(plan.body)}'`,
  ].join(' \\\n');
};
