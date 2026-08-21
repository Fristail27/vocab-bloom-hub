import { ResponseMapperIdE, RunIdentityT } from '../types';

export type ExternalResponseT = {
  status: number;
  // parsed JSON body when the response was JSON, otherwise undefined
  json: unknown;
  text: string;
};

/** A parsed response path: object keys and array indexes; empty = the whole response */
export type ResponsePathT = (string | number)[];

/**
 * A response mapper turns one external response into the payload of one
 * output line. Mappers are named functions shipped with the app: nothing
 * user-supplied is ever evaluated. With a non-empty path the mapper works on
 * the value found at that path instead of auto-detecting the model text.
 */
export type ResponseMapperT = (response: ExternalResponseT, path: ResponsePathT) => unknown;

export class MapperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MapperError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getPath = (value: unknown, path: ResponsePathT): unknown => {
  let current: unknown = value;
  for (const key of path) {
    if (Array.isArray(current) && typeof key === 'number') current = current[key];
    else if (isRecord(current)) current = current[String(key)];
    else return undefined;
  }
  return current;
};

// one segment: [0], ["key"], ['key'] or a bare name; dots between segments
const PATH_TOKEN_RE = /\[(\d+)\]|\["((?:[^"\\]|\\.)*)"\]|\['((?:[^'\\]|\\.)*)'\]|([^.[\]'"]+)|(\.)/y;

/**
 * Parses a user-typed response path such as `choices[0].message.content`,
 * `choices.0.message.content` or `$.data["items"][1]`. Bare numeric segments
 * become array indexes. Returns null when the text is not a valid path; an
 * empty text is the empty path (the whole response).
 */
export const parseResponsePath = (text: string): ResponsePathT | null => {
  let rest = text.trim();
  if (rest.startsWith('$')) rest = rest.slice(1);
  if (!rest) return [];

  const path: ResponsePathT = [];
  PATH_TOKEN_RE.lastIndex = 0;
  let expectSegment = true;
  while (PATH_TOKEN_RE.lastIndex < rest.length) {
    const match = PATH_TOKEN_RE.exec(rest);
    if (!match) return null;
    const [, index, doubleQuoted, singleQuoted, bare, dot] = match;
    if (dot !== undefined) {
      // a dot separates two segments; a leading dot is tolerated (`$.a`), doubled dots are not
      if (expectSegment && path.length) return null;
      expectSegment = true;
      continue;
    }
    if (index !== undefined) path.push(Number(index));
    else if (doubleQuoted !== undefined) path.push(doubleQuoted.replace(/\\(.)/g, '$1'));
    else if (singleQuoted !== undefined) path.push(singleQuoted.replace(/\\(.)/g, '$1'));
    else if (bare !== undefined) path.push(/^\d+$/.test(bare) ? Number(bare) : bare);
    expectSegment = false;
  }
  return expectSegment ? null : path;
};

export const formatResponsePath = (path: ResponsePathT): string =>
  path.map((seg, i) => (typeof seg === 'number' ? `[${seg}]` : i === 0 ? seg : `.${seg}`)).join('');

/** The value the mappers work on when a response path is set */
const selectAtPath = (response: ExternalResponseT, path: ResponsePathT): unknown => {
  if (response.json === undefined)
    throw new MapperError('the response body is not JSON, the response path cannot be applied');
  const value = getPath(response.json, path);
  if (value === undefined)
    throw new MapperError(`nothing found at the response path "${formatResponsePath(path)}"`);
  return value;
};

// Text locations of the popular LLM APIs, most specific first
const TEXT_PATHS: ResponsePathT[] = [
  ['choices', 0, 'message', 'content'], // OpenAI chat completions
  ['output_text'], // OpenAI responses (convenience field)
  ['content', 0, 'text'], // Anthropic messages
  ['candidates', 0, 'content', 'parts', 0, 'text'], // Gemini
  ['message', 'content'], // Ollama chat
  ['response'], // Ollama generate
  ['text'],
  ['output'],
];

const collectTextParts = (value: unknown): string[] => {
  // OpenAI responses API: output[].content[].text
  if (!Array.isArray(value)) return [];
  const parts: string[] = [];
  for (const block of value) {
    const content = getPath(block, ['content']);
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      const text = getPath(c, ['text']);
      if (typeof text === 'string') parts.push(text);
    }
  }
  return parts;
};

/** Pulls the model text out of a response body; falls back to the raw text */
export const extractText = (response: ExternalResponseT): string => {
  const { json, text } = response;
  if (typeof json === 'string') return json;
  if (isRecord(json)) {
    for (const path of TEXT_PATHS) {
      const found = getPath(json, path);
      if (typeof found === 'string' && found.trim()) return found;
      if (Array.isArray(found)) {
        const parts = collectTextParts(found);
        if (parts.length) return parts.join('\n');
      }
    }
  }
  return text;
};

/**
 * Finds the first JSON value in free text: a fenced ```json block first, then
 * the widest {...} or [...] span. Throws a MapperError when nothing parses.
 */
export const parseFirstJson = (text: string): unknown => {
  const candidates: string[] = [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  candidates.push(text.trim());

  for (const open of ['{', '[']) {
    const close = open === '{' ? '}' : ']';
    const start = text.indexOf(open);
    const end = text.lastIndexOf(close);
    if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next candidate
    }
  }
  throw new MapperError('no JSON found in the response text');
};

export const responseMappers: Record<ResponseMapperIdE, ResponseMapperT> = {
  // the model answers with JSON inside its text: take the text (auto-detected
  // or at the path), then the first JSON value in it; a non-string value at
  // the path is already the JSON payload
  [ResponseMapperIdE.json_in_text]: (response, path) => {
    if (!path.length) return parseFirstJson(extractText(response));
    const value = selectAtPath(response, path);
    return typeof value === 'string' ? parseFirstJson(value) : value;
  },
  // the response body (or the value at the path) itself is the payload
  [ResponseMapperIdE.json_body]: (response, path) => {
    if (path.length) return selectAtPath(response, path);
    if (response.json === undefined) throw new MapperError('the response body is not JSON');
    return response.json;
  },
  // keep the model text (or the value at the path) as is
  [ResponseMapperIdE.text]: (response, path) => {
    if (!path.length) return { text: extractText(response) };
    const value = selectAtPath(response, path);
    return { text: typeof value === 'string' ? value : JSON.stringify(value) };
  },
};

/** Shapes the mapped payload into one output line next to the row identity */
export const toResultLine = (identity: RunIdentityT, mapped: unknown): RunIdentityT => ({
  ...identity,
  ...(isRecord(mapped) ? mapped : { result: mapped }),
});
