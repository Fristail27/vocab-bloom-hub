/**
 * Every failed request throws one of these. `code` is the machine-readable
 * error of the API (`ErrorCodes` on the server: `word_doesnt_found`,
 * `invalid_cursor`, `too_many_requests`, …) or one of the client's own:
 * `http_error` for a non-JSON answer (a proxy page, for instance) and
 * `network_error` when the request never got an answer.
 */
export class VocabBloomError extends Error {
  /** HTTP status, 0 when the request did not complete */
  readonly status: number;
  /** Error code of the API, or `http_error` / `network_error` */
  readonly code: string;
  /** The parsed error body when the API sent one */
  readonly body: unknown;

  constructor(message: string, options: { status: number; code: string; body?: unknown; cause?: unknown }) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'VocabBloomError';
    this.status = options.status;
    this.code = options.code;
    this.body = options.body;
  }
}

/** 404: no headword, id or random entry matches */
export class NotFoundError extends VocabBloomError {
  constructor(message: string, options: { code: string; body?: unknown }) {
    super(message, { ...options, status: 404 });
    this.name = 'NotFoundError';
  }
}

/** 429: the rate limit of the public prefix; `retryAfter` is seconds when the server said */
export class RateLimitError extends VocabBloomError {
  readonly retryAfter: number | null;

  constructor(message: string, options: { code: string; body?: unknown; retryAfter: number | null }) {
    super(message, { status: 429, code: options.code, body: options.body });
    this.name = 'RateLimitError';
    this.retryAfter = options.retryAfter;
  }
}

/** The request never got an answer: DNS, connection, TLS, or an abort */
export class NetworkError extends VocabBloomError {
  constructor(message: string, cause: unknown) {
    super(message, { status: 0, code: 'network_error', cause });
    this.name = 'NetworkError';
  }
}

type ErrorBodyT = { statusCode?: number; message?: unknown; error?: boolean };

const parseRetryAfter = (value: string | null): number | null => {
  if (value === null) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(0, Math.ceil((at - Date.now()) / 1000));
};

/** Turns a non-2xx response into the matching error (reads the body) */
export const errorFromResponse = async (response: Response): Promise<VocabBloomError> => {
  let body: unknown;
  let code = 'http_error';
  try {
    body = await response.json();
    const message = (body as ErrorBodyT)?.message;
    if (typeof message === 'string') code = message;
    else if (Array.isArray(message)) code = String(message[0] ?? 'http_error');
  } catch {
    body = undefined;
  }
  const message = `${response.status} ${code} (${response.url})`;
  if (response.status === 404) return new NotFoundError(message, { code, body });
  if (response.status === 429) {
    return new RateLimitError(message, {
      code,
      body,
      retryAfter: parseRetryAfter(response.headers.get('retry-after')),
    });
  }
  return new VocabBloomError(message, { status: response.status, code, body });
};
