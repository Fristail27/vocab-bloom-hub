# Reverse proxy, TLS and keeping the admin API private

The server (`SERVER_PORT`, 3010) and the frontend (`FRONT_PORT`, 3000) both speak plain HTTP on
their own ports. In production a reverse proxy sits in front of them and does three things:

1. **Terminates TLS.** The admin cookie is `secure` in production, so without HTTPS nobody can
   sign in.
2. **Routes one origin to two processes.** `/api/*` goes to the server, everything else to the
   frontend, so the UI calls the API on its own origin (`NEXT_PUBLIC_BASE_API_URL=https://dict.example.com/api`).
3. **Decides what is reachable from where.** The public read-only API (`/api/v1`) and the admin
   API (`/api/en`, `/api/settings`, `/api/auth`) share one host; the proxy is the place to expose
   the first and fence the second.

The examples below are copy-and-adapt templates, not part of the application: the proxy is
whatever runs on your host. Both were verified against a running instance (routing, TLS, the
import/export progress stream, the admin deny rules). Replace `dict.example.com` and the ports
with yours.

## Before the proxy: the server side

| Setting                    | Value behind a proxy           | Why                                                                                                                                                                             |
| -------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TRUST_PROXY`              | `1` (one proxy hop)            | The rate limits (`PUBLIC_API_RATE_LIMIT`, login) and the logs key on the client address. Without it every request carries the proxy's address and all clients share one budget. |
| `NEXT_PUBLIC_BASE_API_URL` | `https://dict.example.com/api` | The browser and the frontend's server-side rendering call the API through the proxy. Baked into the frontend build.                                                             |
| `CORS_ORIGINS`             | `https://dict.example.com`     | The origin(s) a browser may call the API from with credentials.                                                                                                                 |
| `NODE_ENV`                 | `production`                   | `secure` cookie, Swagger UI off, Postgres required.                                                                                                                             |

`TRUST_PROXY` is handed to Express's [`trust proxy`](https://expressjs.com/en/guide/behind-proxies.html)
setting: a hop count (`1` for the usual single proxy, `2` for a CDN in front of it), `loopback`,
an IP or CIDR list (`10.0.0.0/8, 172.16.0.0/12`), or `true` for every hop. Prefer the hop count:
`true` trusts a client-supplied `X-Forwarded-For` whenever the proxy appends rather than
replaces the header, and a client could then forge its address and dodge the limits. Leave the
variable unset when no proxy is in front — the server then ignores `X-Forwarded-*` entirely. The
setting is logged at startup (`Trust proxy: 1 — client addresses are read from X-Forwarded-For`).

## What the proxy must do

- Pass `Host`, `X-Forwarded-For` and `X-Forwarded-Proto` to both apps (Caddy does by default,
  nginx needs the `proxy_set_header` lines).
- **Not buffer `/api/*` responses.** The dictionary import and export report progress as an
  NDJSON stream that the admin UI reads line by line; a buffering proxy holds the whole stream
  and the progress bar freezes at 0 % and then jumps to done. The server marks those responses
  with `X-Accel-Buffering: no` (which nginx honours on its own) and Caddy flushes chunked
  responses immediately, so the explicit settings below are belt and braces.
- **Allow long requests on `/api/*`.** An import runs for minutes; the server's own timeouts
  are 5 minutes per request. Give the proxy at least that (`proxy_read_timeout 600s`).
- **Allow large request bodies on `/api/*`.** Importing from an uploaded archive sends up to
  `512 MB` (nginx: `client_max_body_size 512m`; Caddy has no limit by default).

## Caddy

Recommended for self-hosting: TLS certificates are obtained and renewed automatically for a
public hostname. `/etc/caddy/Caddyfile`:

```caddyfile
dict.example.com {
	encode gzip

	# API: streamed progress must reach the browser as it is produced
	handle /api/* {
		reverse_proxy 127.0.0.1:3010 {
			flush_interval -1
		}
	}

	# everything else is the Next.js frontend
	handle {
		reverse_proxy 127.0.0.1:3000
	}
}
```

Caddy sets `X-Forwarded-For` / `X-Forwarded-Proto` / `X-Forwarded-Host` by itself and keeps
`Host`. For a LAN hostname without a public certificate add `tls internal` inside the site block
(Caddy's own CA; install its root certificate on the clients).

## nginx

`/etc/nginx/conf.d/vocab-bloom-hub.conf`, with certificates from certbot or any other source:

```nginx
upstream vbh_server   { server 127.0.0.1:3010; }
upstream vbh_frontend { server 127.0.0.1:3000; }

server {
    listen 80;
    server_name dict.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name dict.example.com;

    ssl_certificate     /etc/letsencrypt/live/dict.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dict.example.com/privkey.pem;

    # dataset upload (import from an archive)
    client_max_body_size 512m;

    location /api/ {
        proxy_pass http://vbh_server;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # import / export progress is an NDJSON stream: deliver lines as they come
        proxy_buffering         off;
        proxy_request_buffering off;
        proxy_read_timeout      600s;
    }

    location / {
        proxy_pass http://vbh_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Exposure profiles

Three ways to place one instance, from the most closed to the most open. All use the configs
above; the profile decides what is added.

### (a) Everything private

The instance lives on a LAN or behind a VPN and the proxy is reachable only from there. Nothing
to add: the configs above as they are (with `tls internal` in Caddy or an internal CA
certificate in nginx when the hostname is not public). Both API surfaces and the admin UI are
available to whoever can reach the host.

### (b) Public dictionary, private admin

The public read API (`/api/v1`) and, if wanted, the frontend are on the internet; the admin
prefixes answer only from trusted networks. The rules go **before** the general `/api/` rule.

Caddy — allow from private networks, `404` for the rest (as if the surface did not exist):

```caddyfile
dict.example.com {
	encode gzip

	@adminApi path /api/en/* /api/settings /api/settings/* /api/auth /api/auth/*
	@trusted remote_ip 10.0.0.0/8 127.0.0.1 ::1

	handle @adminApi {
		handle @trusted {
			reverse_proxy 127.0.0.1:3010 {
				flush_interval -1
			}
		}
		respond 404
	}

	handle /api/* {
		reverse_proxy 127.0.0.1:3010 {
			flush_interval -1
		}
	}

	handle {
		reverse_proxy 127.0.0.1:3000
	}
}
```

nginx — a regex `location` wins over the `/api/` prefix, so it takes the admin prefixes out of it:

```nginx
    location ~ ^/api/(en|settings|auth)(/|$) {
        allow 10.0.0.0/8;   # office / VPN
        allow 127.0.0.1;    # the frontend's server-side rendering, when it runs on this host
        allow ::1;
        deny  all;          # 403; use `return 404;` instead of the allow/deny lines to hide the surface

        proxy_pass http://vbh_server;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering         off;
        proxy_request_buffering off;
        proxy_read_timeout      600s;
    }
```

Basic auth at the proxy is an alternative to the address list (`basicauth` in Caddy,
`auth_basic` in nginx) — put it on the same matcher. The admin login stays behind it; the two
are independent.

Two things to keep in mind with this profile:

- **The frontend's server-side rendering calls the admin API too**, through
  `NEXT_PUBLIC_BASE_API_URL`, i.e. from the frontend host through the proxy. The address those
  requests arrive from must be in the allow list — `127.0.0.1` and `::1` when the frontend
  runs on the proxy host and the hostname resolves locally (an `/etc/hosts` entry makes sure
  it does), otherwise the host's own address — or the admin pages fail to render even for a
  trusted browser. Loopback can be either address family, so list both.
- **The frontend is the admin UI.** Without the admin API a visitor sees the login page (which
  cannot sign in) and the API documentation page. Restrict `/` with the same allow list if
  even that is too much; the public API does not depend on the frontend.

### (c) Public-only instance

A demo or an embedded dictionary that nobody edits in place: set `ADMIN_API_ENABLED=false` and
the server itself answers `404` on the admin prefixes — no proxy rule can be forgotten. Edit
the data on a private instance and move it over with the dataset export / import
([`../offline-import.md`](../offline-import.md)). The frontend can be left out entirely;
`/api/v1` needs only the server.

The opposite switch, `PUBLIC_API_ENABLED=false`, makes an editing-only instance whose
dictionary is not readable from outside. Both switches are described in
[`../api.md`](../api.md#running-a-public-only-or-admin-only-instance).

## Checklist

- [ ] `https://` end to end — the admin cookie is not sent over plain HTTP.
- [ ] `TRUST_PROXY` set to the number of proxy hops; the startup log confirms it.
- [ ] `NEXT_PUBLIC_BASE_API_URL` and `CORS_ORIGINS` are the public origin; the frontend was
      rebuilt after setting them.
- [ ] `ADMIN_USERNAME` / `ADMIN_PASSWORD` are long and random — the single admin account is the
      whole authentication.
- [ ] The Swagger UI is off (`NODE_ENV=production` does that); `GET /api/v1/openapi.json` stays
      on and is public by design.
- [ ] The public rate limit (`PUBLIC_API_RATE_LIMIT`) fits the expected traffic; a CDN or a
      shared cache in front honours the `Cache-Control` / `ETag` of `/api/v1` responses
      ([`../api.md`](../api.md#caching)).
- [ ] Admin prefixes are either fenced at the proxy (profile b) or switched off
      (`ADMIN_API_ENABLED=false`, profile c).
- [ ] The Prometheus endpoint (`METRICS_ENABLED`, [`../observability.md`](../observability.md)) is
      scraped on the private network or fenced like the admin prefixes — never public.
- [ ] The import/export stream works through the proxy: start an export from the admin UI and
      watch the progress bar move, not jump.
