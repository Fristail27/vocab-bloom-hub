# @vocab-bloom-hub/client

Typed client for the public read-only API of a [Vocab Bloom Hub](https://github.com/Fristail27/vocab-bloom-hub) instance — an English dictionary with IPA, CEFR levels, sense-level definitions, examples, Russian translations and inflected forms, served under `/api/v1`.

- One method per endpoint, typed from the server's OpenAPI document — the types cannot drift from the API.
- Node.js ≥ 20 and browsers; `fetch` only, no dependencies; ESM and CommonJS.
- Errors are thrown as typed exceptions; `AbortSignal` on every call; optional ETag cache for repeated reads.

## Install

The package is not on npm yet (it follows the first alpha release, [#308](https://github.com/Fristail27/vocab-bloom-hub/issues/308)). Until then install it from the repository:

```bash
# from a checkout of the monorepo
yarn workspace @vocab-bloom-hub/client build
yarn workspace @vocab-bloom-hub/client pack --out /tmp/vocab-bloom-hub-client.tgz
npm install /tmp/vocab-bloom-hub-client.tgz
```

## Quick start

```ts
import { VocabBloomClient, NotFoundError } from '@vocab-bloom-hub/client';

const client = new VocabBloomClient({ baseUrl: 'https://dict.example.com' });

// search: relevance tiers, typo tolerance
const { data, meta } = await client.search({ search: 'recieve' });
console.log(meta.fuzzy, data[0].word); // true "receive"

// a headword with every part of speech, forms, meanings and translations
try {
  const run = await client.word('run');
  console.log(run.data[0].meanings[0].definition);
} catch (error) {
  if (error instanceof NotFoundError) console.log('no such word');
  else throw error;
}

// walk the whole dictionary, page after page
for await (const word of client.iterateWords({ word_level: ['A1', 'A2'], with_meanings: true })) {
  console.log(word.word, word.meanings.length);
}
```

## API

| Method                           | Endpoint                           | Answer                     |
| -------------------------------- | ---------------------------------- | -------------------------- |
| `search(request)`                | `POST /search`                     | `SearchResponse`           |
| `searchDetailed(request)`        | `POST /search/detailed`            | `DetailedSearchResponse`   |
| `word(headword)`                 | `GET /words/{word}`                | `HeadwordResponse`         |
| `wordById(id)`                   | `GET /words/id/{id}`               | `WordResponse`             |
| `meanings(headword)`             | `GET /words/{word}/meanings`       | `MeaningsResponse`         |
| `translations(headword, query?)` | `GET /words/{word}/translations`   | `TranslationsResponse`     |
| `forms(headword)`                | `GET /words/{word}/forms`          | `FormsResponse`            |
| `words(query?)`                  | `GET /words`                       | `WordsResponse` (one page) |
| `iterateWords(query?)`           | `GET /words`, following the cursor | `AsyncGenerator<Word>`     |
| `random(filters?)`               | `GET /random`                      | `WordResponse`             |
| `meta()`                         | `GET /meta`                        | `MetaResponse`             |
| `openapi()`                      | `GET /openapi.json`                | the OpenAPI 3 document     |

Every method resolves to the `{ data, meta }` envelope the API answers with and takes an optional last argument `{ signal, headers }`. The request and response types (`Word`, `Meaning`, `SearchRequest`, `ListWordsQuery`, …) are exported, and so are the raw generated `paths` / `components` / `operations` for anything not aliased. The contract itself — tiers, filters, cursor pagination, caching — is documented in the server's [`docs/api.md`](https://github.com/Fristail27/vocab-bloom-hub/blob/main/docs/api.md).

### Options

```ts
new VocabBloomClient({
  baseUrl: 'https://dict.example.com', // origin of the instance; /api/v1 is appended
  headers: { 'X-App': 'my-app' }, // sent with every request
  cache: true, // ETag revalidation (see below); or your own ResponseCache
  fetch: myFetch, // a custom fetch (instrumentation, polyfills, tests)
});
```

### Errors

Failed requests throw:

| Class             | When                                   | Fields                                         |
| ----------------- | -------------------------------------- | ---------------------------------------------- |
| `NotFoundError`   | 404                                    | `status`, `code` (`word_doesnt_found`), `body` |
| `RateLimitError`  | 429 — the public rate limit            | `retryAfter` (seconds, from `Retry-After`)     |
| `NetworkError`    | no answer: DNS, connection, TLS, abort | `status: 0`, `code: 'network_error'`, `cause`  |
| `VocabBloomError` | everything else                        | `status`, `code`, `body`                       |

`code` is the machine-readable error of the API (`invalid_cursor`, `too_many_requests`, …), or `http_error` when the answer was not JSON (a proxy page, for instance).

### ETag cache

With `cache: true` every `GET` answer is kept in memory per URL together with its `ETag`; the next read of the same URL sends `If-None-Match` and, on `304 Not Modified`, returns the kept body — the round trip stays, the payload does not. `MemoryCache` holds 500 entries (least recently used out); pass an object with `get(url)` / `set(url, entry)` for a store of your own. Off by default.

## Development

```bash
yarn workspace @vocab-bloom-hub/client generate        # types from apps/server/openapi/public-v1.json
yarn workspace @vocab-bloom-hub/client generate:check  # fail when the generated types are stale (CI)
yarn workspace @vocab-bloom-hub/client build           # dist/ (ESM, CJS, d.ts)
yarn workspace @vocab-bloom-hub/client test            # unit tests + the client against the real server on SQLite
```

`src/generated/openapi.ts` is produced by `openapi-typescript` from the committed public spec and committed itself: a contract change on the server shows up as a diff here, and `test/contract.spec.ts` fails until every operation of the spec has a client method.

## License

MIT — the dictionary data an instance serves is [CC BY 4.0](https://github.com/Fristail27/vocab-bloom-hub/blob/main/DATA_LICENSE.md).
