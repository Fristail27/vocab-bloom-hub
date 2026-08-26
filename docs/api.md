# API surfaces: public `/api/v1` and the admin API

The server exposes two surfaces on one host (issue #271):

| Surface    | Prefixes                                  | Auth                              | Purpose                                                                   |
| ---------- | ----------------------------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| **Public** | `/api/v1/*`                               | none                              | Read-only, versioned contract for consuming applications                  |
| **Admin**  | `/api/en/*`, `/api/settings`, `/api/auth` | admin JWT (cookie / Bearer token) | Everything the admin UI does: editing, import / export, statistics, login |

Nothing under `/api/v1` mutates data or requires a login; nothing outside it is part of the
public contract. The Swagger UI at `/api` (development only) documents both, with the public
endpoints under the _Public API v1_ tag.

## The public contract

- **Versioned prefix.** Response shapes under `/api/v1` change only with a new prefix
  (`/api/v2`). The types consumers rely on live in `apps/server/types/public/v1/`.
- **`X-API-Version: 1`** on every response of the prefix, errors included.
- **Envelope for lists:** `{ "data": [...], "meta": { ... } }` — paging and counts go under
  `meta`, never mixed into the items.
- **Errors** reuse the `ErrorResT` shape everywhere under the prefix, whatever raised them
  (validation, an unknown route, the rate limit):

  ```json
  { "statusCode": 429, "message": "too_many_requests", "error": true }
  ```

- **Rate limit.** One budget per client IP for the whole prefix, `PUBLIC_API_RATE_LIMIT`
  (`<requests>/<seconds>`, default `100/60`). Exceeding it answers `429` with the error above.
  There are no API keys yet; put the instance behind a reverse proxy if you need per-client
  quotas.

### Endpoints

| Method | Path                      | Body                                                                                           | Response                                               |
| ------ | ------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `POST` | `/api/v1/search`          | `{ search, type?, limit? }`                                                                    | `{ data: EnSearchWordT[], meta: { count } }`           |
| `POST` | `/api/v1/search/detailed` | `{ search, type?, limit?, page?, with_meanings?, with_translations?, translation_languages? }` | `{ data: EnWordT[], meta: { page, limit, has_more } }` |

The request filters are described on the in-app _Documentation_ pages, which also run live
requests against the current database. Word, meaning and list endpoints are tracked in #272,
the `openapi.json` export in #273, caching headers in #274.

```bash
curl -X POST 'http://localhost:3010/api/v1/search/detailed' \
  -H 'Content-Type: application/json' \
  -d '{"search":"run","with_meanings":true}'
```

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
internet, expose `/api/v1` and block the admin prefixes at the proxy — or serve the admin
prefixes only from a private network. The full deployment guide (TLS, Caddy / nginx configs,
exposure profiles) is tracked in #283; the rule of thumb until then:

```nginx
location /api/v1/ { proxy_pass http://server:3010; }
location ~ ^/api/(en|settings|auth)(/|$) { return 404; }
```

Set `CORS_ORIGINS` to the origins that may call the API from a browser; `curl`-style clients
are not affected by CORS.
