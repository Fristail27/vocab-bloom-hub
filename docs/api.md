# API surfaces: public `/api/v1` and the admin API

The server exposes two surfaces on one host (issue #271):

| Surface    | Prefixes                                  | Auth                              | Purpose                                                                   |
| ---------- | ----------------------------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| **Public** | `/api/v1/*`                               | none                              | Read-only, versioned contract for consuming applications                  |
| **Admin**  | `/api/en/*`, `/api/settings`, `/api/auth` | admin JWT (cookie / Bearer token) | Everything the admin UI does: editing, import / export, statistics, login |

Nothing under `/api/v1` mutates data or requires a login; nothing outside it is part of the
public contract. The Swagger UI at `/api` (development only) documents both, with the public
endpoints under the _Public API v1_ tag; the public contract alone is exported as an
[OpenAPI document](#openapi-document).

## The public contract

- **Versioned prefix.** Response shapes under `/api/v1` change only with a new prefix
  (`/api/v2`). The types consumers rely on live in `apps/server/types/public/v1/`.
- **`X-API-Version: 1`** on every response of the prefix, errors included.
- **Envelope:** every successful answer is `{ "data": ..., "meta": { ... } }` — the payload
  under `data` (a list or one object), paging and counts under `meta`, never mixed into
  the items.
- **Errors** reuse the `ErrorResT` shape everywhere under the prefix, whatever raised them
  (validation, an unknown route, the rate limit):

  ```json
  { "statusCode": 429, "message": "too_many_requests", "error": true }
  ```

- **Rate limit.** One budget per client IP for the whole prefix, `PUBLIC_API_RATE_LIMIT`
  (`<requests>/<seconds>`, default `100/60`). Exceeding it answers `429` with the error above.
  There are no API keys yet; put the instance behind a reverse proxy if you need per-client
  quotas.
- **Cacheable.** Every successful `GET` carries `ETag`, `Last-Modified` and `Cache-Control:
public, max-age=<PUBLIC_API_CACHE_MAX_AGE>`; conditional requests answer `304` — see
  [Caching](#caching).

### Endpoints

Every successful answer is an envelope: the payload under `data`, paging and counts under
`meta`. The response types are in `apps/server/types/public/v1/index.ts`.

| Method | Path                                | Query / body                                                                                   | Response                                                                   |
| ------ | ----------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `POST` | `/api/v1/search`                    | `{ search, type?, limit? }`                                                                    | `{ data: EnSearchWordT[], meta: { count, fuzzy, short_term } }`            |
| `POST` | `/api/v1/search/detailed`           | `{ search, type?, limit?, page?, with_meanings?, with_translations?, translation_languages? }` | `{ data: EnWordT[], meta: { page, limit, has_more, fuzzy, short_term } }`  |
| `GET`  | `/api/v1/words/{word}`              | —                                                                                              | `{ data: EnWordT[], meta: { word, count } }`                               |
| `GET`  | `/api/v1/words/{word}/meanings`     | —                                                                                              | `{ data: PublicMeaningV1T[], meta: { word, count } }`                      |
| `GET`  | `/api/v1/words/{word}/translations` | `language?`                                                                                    | `{ data: { short_translations, meaning_translations }, meta }`             |
| `GET`  | `/api/v1/words/{word}/forms`        | —                                                                                              | `{ data: PublicWordFormV1T[], meta: { word, count } }`                     |
| `GET`  | `/api/v1/words/id/{id}`             | —                                                                                              | `{ data: EnWordT }`                                                        |
| `GET`  | `/api/v1/words`                     | filters, `cursor?`, `limit?`, `with_meanings?`, `with_translations?`                           | `{ data: EnWordT[], meta: { limit, has_more, next_cursor } }`              |
| `GET`  | `/api/v1/random`                    | filters                                                                                        | `{ data: EnWordT }`                                                        |
| `GET`  | `/api/v1/meta`                      | —                                                                                              | `{ data: { api_version, app_version, dataset_version, license, counts } }` |

Every endpoint and its parameters are also described on the in-app _Documentation_ pages,
which run live requests against the current database. The machine-readable contract is the
[OpenAPI document](#openapi-document).

```bash
curl -X POST 'http://localhost:3010/api/v1/search/detailed' \
  -H 'Content-Type: application/json' \
  -d '{"search":"run","with_meanings":true}'

curl 'http://localhost:3010/api/v1/words/run'
curl 'http://localhost:3010/api/v1/words?part_of_speech=noun&word_level=B1&word_level=B2&limit=50'
curl 'http://localhost:3010/api/v1/random?part_of_speech=verb&word_level=A2'
```

#### Search tiers and typo tolerance

Both search endpoints rank their answer by tiers: exact headword, phrasal variants, starts
with the term, phrases containing it as a word, ends with it, contains it anywhere. Every tier
is served by an index on Postgres (a byte-order btree for the prefixes, a trigram GIN for the
rest — issue #278).

When no tier matches at all, a **fuzzy tier** answers instead: headwords whose trigrams are
similar enough to the term (`pg_trgm`, similarity ≥ 0.3), best match first. Such an answer
carries `meta.fuzzy: true` and a `similarity` (0–1) on every item — the "did you mean"
signal for a UI or an SDK:

```json
{ "data": [{ "word": "relieve", "similarity": 0.45, "…": "…" }], "meta": { "count": 8, "fuzzy": true } }
```

`fuzzy` is `false` whenever the exact tiers found something, and also when nothing at all is
similar (empty `data`). The fuzzy tier exists on Postgres instances only (`pg_trgm`); a
SQLite instance answers an empty list for a typo, with `fuzzy: false`.

A term of **one or two characters** (after trimming) searches the exact and prefix tiers
only — the headword itself, its phrasal variants, an inflected form's base entry and
headwords starting with the term — and answers with `meta.short_term: true`. The suffix,
substring, phrase and fuzzy tiers are skipped: half the dictionary contains any given letter,
so those tiers would return an arbitrary slice rather than a match, and a trigram index has
nothing to look up in fewer than three characters. `a`, `I`, `ok`, `TV` still answer, as
exact headwords; a blank term answers an empty list.

#### Headword reads

`GET /api/v1/words/{word}` answers **every entry** of a headword — one item per part of
speech, each with its forms, meanings (definitions, examples, translations, synonyms,
antonyms) and short translations. The spelling is matched case-insensitively; URL-encode
spaces for phrases (`/api/v1/words/put%20up%20with`). An inflected form resolves to its base
entry: `/api/v1/words/ran` answers the verb _run_ (with `ran` among its `forms`). An unknown
spelling answers `404` with `word_doesnt_found`.

The partial reads (`/meanings`, `/translations`, `/forms`) flatten the same entries into one
list; every item carries `word_id` and `part_of_speech` so it can be tied back to its entry.
`/translations` splits into `short_translations` (per entry) and `meaning_translations` (per
meaning, with `meaning_id`); `?language=ru` keeps one language only.

`GET /api/v1/words/id/{id}` is the same entry by its numeric id (the `id` of any item above).

#### Filtered list and cursor pagination

`GET /api/v1/words` lists entries ordered by `(word, id)` — the headword by its bytes
(`COLLATE "C"` on Postgres, the default on SQLite: `a bag of wind` before `aaron burr`,
whatever the database locale), then the id. Filters: `part_of_speech`,
`word_level`, `language_register`, `category`, `area_variant`, `form_of_word`. Every filter
accepts one value or a repeated key; values of one filter are OR-ed, different filters are
AND-ed (`?word_level=B1&word_level=B2&part_of_speech=noun` — B1 or B2 nouns). Without
`form_of_word` only base forms are listed; inflected forms are reachable through their base
entry's `forms` or explicitly (`?form_of_word=past_simple`). Items carry no meanings or
short translations unless `with_meanings=true` / `with_translations=true` is passed.

Pages are read with a cursor: take `meta.next_cursor` of a page and pass it back as
`?cursor=` (with the same filters) to get the next one; `next_cursor` is `null` on the last
page and `has_more` says whether there is one. The cursor is opaque — do not build it by
hand; an unrecognised value answers `400` with `invalid_cursor`. Unlike page numbers, a
cursor never repeats or skips an item while the dictionary is being edited. `limit` is
1–100, default 20.

#### Random entry

`GET /api/v1/random` answers one random entry matching the same filters as the list (base
forms unless `form_of_word` is given); `404` when nothing matches. The draw is an index
lookup, not `ORDER BY random()` — cheap on a 300k-row dictionary; entries right after a gap
in the ids come up slightly more often, which does not matter for a "word of the day".

#### Meta

`GET /api/v1/meta` describes what the instance serves: `api_version` (`"1"`), `app_version`
(the server's `package.json`), `dataset_version` (the version of the dataset the dictionary
was last imported from, `null` for data authored in place or imported without a manifest),
the terms of the data — `license` (the SPDX identifier, `"CC-BY-4.0"`), `license_url` and
`attribution` (the line a consumer has to show, see [`DATA_LICENSE.md`](../DATA_LICENSE.md)) —
and `counts` (entries, words, phrases, grammar patterns, word forms, meanings, meaning and short
translations; the counts are refreshed at most once a minute).

### OpenAPI document

The contract above is also an OpenAPI 3 document (issue #273), built from the controllers,
DTOs and response types of the running code — nothing is hand-written, so it cannot drift:

- **`GET /api/v1/openapi.json`** serves it from any running instance, production included
  (the Swagger UI at `/api` stays development-only). It carries the caching headers of the
  prefix like every other public `GET`.
- **`apps/server/openapi/public-v1.json`** is the same document committed to the repository:
  the source for SDK generators (#275, #276) and the docs site (#277), and the place where a
  contract change shows up in a pull request diff.

```bash
yarn workspace server openapi:generate   # rewrites openapi/public-v1.json + public-v1.schemas.json (+ admin.json, not committed)
yarn workspace server openapi:check      # fails when a committed file is stale — CI runs this
```

The generator bootstraps the application without listening, on an in-memory SQLite database,
so it needs no `.env` and its output depends on the source code only. After changing anything
under `/api/v1` (a route, a DTO, a Swagger decorator, a type in `types/public/v1`) run
`openapi:generate` and commit the result; the `check-pull-request` workflow rejects a stale
spec. `admin.json` — the whole API including the admin surface — is written next to it for
local use and ignored by git.

**Response schemas** (issue #305). The controllers type their answers with the TypeScript
contract in `apps/server/types/public/v1`, which Swagger cannot see, so the generator reads
those types with `ts-json-schema-generator`, converts the result to OpenAPI 3.0 component
schemas (`nullable` for `| null`, enums, generics inlined; `src/openapi/json-schema-to-openapi.ts`)
and commits them to `openapi/public-v1.schemas.json`. `src/openapi/public-responses.ts` maps
every public operation to its response type and error statuses; the document build fails for a
route missing there, so an endpoint cannot ship untyped. The running server serves the committed
schemas — no TypeScript at runtime. `test/public-schemas.e2e-spec.ts` calls every operation on a
seeded dictionary and validates the real bodies against the served schemas (strictly, unknown
fields fail), which is what makes the schemas trustworthy for SDK generators (#275, #276).

### SDKs

- **Node.js / TypeScript** — [`@vocab-bloom-hub/client`](../packages/npm-sdk/README.md) (issue #275):
  one method per endpoint, types generated from `openapi/public-v1.json`, typed errors, cursor
  iteration, optional ETag cache. Built and tested in this repository; published to npm with the
  first alpha (#308).
- **Python** — planned (#276).

### Caching

Dictionary data changes rarely, so the public `GET` reads are built to be cached by browsers,
CDNs and reverse proxies (issue #274). Every successful `GET` answer carries:

| Header          | Value                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| `ETag`          | weak, a hash of the JSON body: `W/"…"`. Changes exactly when the answer changes                                |
| `Last-Modified` | the newest change anywhere in the dictionary (entries, words, meanings, translations), refreshed once a minute |
| `Cache-Control` | `public, max-age=<PUBLIC_API_CACHE_MAX_AGE>` (default `3600`); `public, no-cache` when the variable is `0`     |

A client that sends the tag back revalidates in one bodiless round trip:

```bash
curl -i 'http://localhost:3010/api/v1/words/run'                                   # 200, ETag: W/"…"
curl -i -H 'If-None-Match: W/"…"' 'http://localhost:3010/api/v1/words/run'         # 304, no body
curl -i -H 'If-Modified-Since: <Last-Modified>' 'http://localhost:3010/api/v1/words/run'
```

Invalidation is implicit: the `ETag` is a content hash, so the first answer after an edit or
an import carries a new tag and a `304` is never served for changed data. `Last-Modified` is
informational (a minute behind at most) — when both validators are sent the `ETag` decides. A
CDN or proxy in front keeps an answer for `max-age` and then revalidates; lower
`PUBLIC_API_CACHE_MAX_AGE` (or set it to `0`) on an instance whose dictionary is edited live.

Not cached: the `POST` search reads (HTTP caches do not store `POST`), every error under the
prefix (`Cache-Control: no-store`, so a miss or a `429` is never served from a cache), and
everything under the admin prefixes (`no-store` on every answer, including `401`s and the
`404`s of a disabled surface).

### Deprecated aliases

`POST /api/en/search` and `POST /api/en/search/detailed` keep answering with the pre-envelope
bodies (`EnSearchWordT[]` and `{ items, page, limit, has_more }`) so existing consumers do not
break. They carry `Deprecation: true` and a `Link: <...>; rel="successor-version"` header
pointing at the `/api/v1` route and will be removed with the alpha release. New integrations
should use `/api/v1` only.

## Running a public-only or admin-only instance

Two switches decide which surfaces an instance serves; both default to on:

| Variable             | Effect when `false`                                                                 |
| -------------------- | ----------------------------------------------------------------------------------- |
| `PUBLIC_API_ENABLED` | `/api/v1/*` answers `404` as if the routes did not exist                            |
| `ADMIN_API_ENABLED`  | `/api/en/*`, `/api/settings`, `/api/auth` answer `404`; the admin UI cannot sign in |

Disabling both is a configuration error and the server refuses to start. A demo or embedded
instance runs with `ADMIN_API_ENABLED=false` (edit the data elsewhere and move it over with the
dataset export / import, see [offline-import.md](./offline-import.md)); an internal editing
instance that must not be readable from outside runs with `PUBLIC_API_ENABLED=false`.

## Keeping the admin API private behind a reverse proxy

When one instance serves both surfaces and only the dictionary should be reachable from the
internet, expose `/api/v1` and fence the admin prefixes (`/api/en`, `/api/settings`,
`/api/auth`) at the proxy — by address list or basic auth — or serve them only from a private
network. Tested Caddy and nginx configs for that, TLS, the `TRUST_PROXY` setting the rate limits
need behind a proxy, and the other exposure profiles are in
[`deployment/reverse-proxy.md`](./deployment/reverse-proxy.md).

Set `CORS_ORIGINS` to the origins that may call the API from a browser; `curl`-style clients
are not affected by CORS.
