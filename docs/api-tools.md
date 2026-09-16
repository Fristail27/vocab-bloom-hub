# Swagger, OpenAPI and the API docs

Four things describe the same API, and it helps to know which one to open when. The source
of truth is the code; everything below is generated from it.

## Swagger UI: every route of a running server

Start the server outside production (`yarn server:dev`, or `NODE_ENV` set to anything but
`production`) and open `http://localhost:3010/api`. That is Swagger UI: a page that lists
every route the server has, with its parameters, and lets you send a request from the
browser. It is served by the server itself from the decorators on the controllers, so it is
always the API of the code you are running — a new route appears there the moment the
controller compiles.

- The public routes are under the _Public API v1_ tag; the admin routes (`/api/en/*`,
  `/api/settings`, `/api/auth`) are next to them, so this is the only place the admin API is
  documented.
- Try a request with **Try it out** → fill the fields → **Execute**. The curl line it prints
  is a correct request you can paste into a terminal.

> [!IMPORTANT]
> Admin routes need the admin token. The simplest way to have one is to log in to the admin UI
> in the same browser: the server sets the token as a cookie, and the browser sends that cookie
> with Swagger UI's requests too (cookies do not distinguish ports on `localhost`). Filling
> `POST /api/auth/login` by hand does not work — it takes a computed login proof, not the
> password ([authentication.md](./authentication.md)). A token obtained elsewhere goes into
> **Authorize** at the top of the page and is sent as a Bearer header.

> [!NOTE]
> Swagger UI is off when `NODE_ENV=production`, and the Docker images run in production. On a
> deployed instance there is nothing at `/api`; the public contract is served as a document
> instead (next section), and the admin API is meant to be reached only by the admin UI.

## The OpenAPI document: the public contract as a file

[OpenAPI](https://www.openapis.org/) is the JSON format Swagger UI reads. The server writes
the public part of it — only `/api/v1`, with the response shapes — and exposes it in two
places:

- **`GET /api/v1/openapi.json`** on every instance, production included. Any OpenAPI tool
  (Postman, Insomnia, an API gateway, a code generator) can import an instance's API from
  that URL.
- **`apps/server/openapi/public-v1.json`** in the repository, the committed copy. Everything
  else is generated from this file: the types of the [npm SDK](../packages/npm-sdk/README.md)
  (`src/generated/openapi.ts`), the pydantic models of the
  [Python SDK](../packages/python-sdk/README.md), and the website's API reference and
  playground (built at build time). CI fails when the file is older than the code, so it
  never drifts.

The chain after a change under `/api/v1`, in order:

```bash
yarn workspace server openapi:generate                    # rewrites public-v1.json from the code
yarn workspace @vocab-bloom-hub/client generate           # npm SDK types from the spec
cd packages/python-sdk && uv run python scripts/generate_models.py   # Python models from the spec
```

> [!IMPORTANT]
> Commit the four generated files together (`public-v1.json`, `public-v1.schemas.json`, the
> SDK types, the Python models). `openapi:check` and the `generate:check` scripts are what CI
> runs to catch a missing step.

The details of the format and of what the generator adds (response schemas, error shapes) are
in [api.md](./api.md#openapi-document).

## The website: reference and playground

The [website](./deployment/docker.md) (`apps/site`, the `site` compose profile) renders the
committed document as two pages:

- **API reference** at `/api` of the site — one section per endpoint, with the parameters,
  the response fields and a curl example, in the six interface languages.
- **Playground** at `/playground` — pick an endpoint, fill the parameters, see the real
  answer of the instance the site is attached to. The requests go through the site's own
  `/api/*` route to the server, so the browser never needs the server's address.

This is the reference to send to someone who consumes the API: it documents the contract,
not the code, and works on a deployed instance where Swagger UI is off.

## The admin UI: Documentation pages

The admin panel has a **Documentation** section in its side menu, one page per public
endpoint: the parameters, the response fields, a copyable request, and a small playground
that calls the instance you are logged in to. It is written by hand (not generated) and aimed
at the person editing the dictionary who wants to see what an application would get for a
word — the answer of `GET /api/v1/words/{word}` for the entry just edited, for instance.

## Which one to open

| I want to…                                          | Open                                                |
| --------------------------------------------------- | --------------------------------------------------- |
| See or call an admin route                          | Swagger UI at `/api` of a non-production server     |
| Check a route I just added                          | Swagger UI, then `openapi:generate` if it is public |
| Import the API into Postman or a generator          | `GET /api/v1/openapi.json`                          |
| Send the docs to a consumer of the API              | The website's API reference and playground          |
| See what an application gets for an entry I edit    | The admin UI, Documentation                         |
| Read the contract's rules (envelope, errors, cache) | [api.md](./api.md)                                  |
