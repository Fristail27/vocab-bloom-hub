# Observability: metrics and logs

The server exposes a Prometheus exposition at `METRICS_PATH` (default `/metrics`) when
`METRICS_ENABLED=true` (issue #281). It answers the two questions an operator has about a
running instance — _can it take my traffic?_ and _why is it slow since yesterday?_ — with
numbers that logs cannot give cheaply: request rate and latency per route, error rate, which
search tier answers, how the dictionary grows, what an import is doing, how busy the Postgres
pool is. The [logs](#logs) below carry the rest: what happened to one request, with what error.

## Enabling and scraping

```dotenv
METRICS_ENABLED=true
METRICS_PATH=/metrics
```

The endpoint lives outside both API surfaces (`/api/v1`, the admin prefixes): no
authentication, no rate limit, `Cache-Control: no-store`, `text/plain` in the Prometheus text
format. It is off by default and **must not be reachable from the internet** — it lists routes,
versions and traffic. Behind the reverse proxy of
[`deployment/reverse-proxy.md`](./deployment/reverse-proxy.md) either do not route it at all
(Prometheus scrapes the server's port directly, on the private network) or fence it like the
admin prefixes:

```nginx
location = /metrics { allow 10.0.0.0/8; deny all; proxy_pass http://vbh_server; }
```

```caddyfile
@metrics path /metrics
handle @metrics {
	@scraper remote_ip 10.0.0.0/8
	handle @scraper { reverse_proxy 127.0.0.1:3010 }
	respond 404
}
```

A scrape job:

```yaml
scrape_configs:
  - job_name: vocab-bloom-hub
    scrape_interval: 15s
    static_configs:
      - targets: ['127.0.0.1:3010']
```

## Metrics

### Process (prom-client defaults)

`process_cpu_*`, `process_resident_memory_bytes`, `nodejs_heap_size_*`,
`nodejs_eventloop_lag_seconds` (and its percentiles), `nodejs_gc_duration_seconds`,
`nodejs_active_handles_total`, … — the standard Node.js set, plus:

| Metric           | Labels                | Meaning                                                           |
| ---------------- | --------------------- | ----------------------------------------------------------------- |
| `vbh_build_info` | `version`, `database` | Always `1`; the server version and driver (`postgres` / `sqlite`) |

### HTTP

Every request is timed by a middleware that runs before routing, so answers produced by the
surface switches and plain 404s count too.

| Metric                          | Type      | Labels                      | Meaning                                                               |
| ------------------------------- | --------- | --------------------------- | --------------------------------------------------------------------- |
| `http_requests_total`           | counter   | `method`, `route`, `status` | Requests answered                                                     |
| `http_request_duration_seconds` | histogram | `method`, `route`, `status` | Time from the request to the end of the response; buckets 5 ms – 60 s |
| `http_requests_in_flight`       | gauge     | —                           | Requests being answered right now                                     |

`route` is the **route template** (`/api/v1/words/:word`, `/api/en/add/:entryType`), never the
raw path — paths are unbounded and would create a series per headword. A request that matched
no route is labelled `unmatched`. The metrics endpoint itself is not counted.

### Dictionary and search

| Metric                                     | Type    | Labels               | Meaning                                                                                                                                                                                       |
| ------------------------------------------ | ------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vbh_search_tier_hits_total`               | counter | `tier`, `short_term` | Searches by the tier that produced the top answer: `exact`, `phrasal`, `prefix`, `phrase`, `suffix`, `contains`, `fuzzy`, `none` (nothing matched); `short_term` marks the 1–2 character flow |
| `vbh_dictionary_size`                      | gauge   | `kind`               | Rows served: `entries`, `words`, `phrases`, `grammar_patterns`, `word_forms`, `meanings`, `meaning_translations`, `short_translations`; refreshed at most once a minute, at scrape time       |
| `vbh_dictionary_transfers_total`           | counter | `kind`, `result`     | Finished imports and exports (`success` / `failure`)                                                                                                                                          |
| `vbh_dictionary_transfer_in_progress`      | gauge   | `kind`               | `1` while an import or export runs                                                                                                                                                            |
| `vbh_dictionary_transfer_progress_percent` | gauge   | `kind`, `stage`      | Progress of the running transfer, with its stage (`saving_words`, `linking_synonyms`, …)                                                                                                      |
| `vbh_db_pool_connections`                  | gauge   | `state`              | Postgres pool: `total`, `idle`, `waiting` clients; absent on SQLite                                                                                                                           |

The tier counter is the tuning signal for the search (issues #278, #292): a growing `fuzzy`
share means users misspell more than the substring tiers catch, a large `none` share means the
dictionary lacks what they look for.

A sustained `waiting` count on `vbh_db_pool_connections` means requests queue for a database
connection: raise `DB_POOL_SIZE` (and mind the connection limit of a managed Postgres — see
[environment.md](./environment.md)).

## Useful queries

```promql
# request rate and error rate, per route
sum by (route) (rate(http_requests_total[5m]))
sum by (route) (rate(http_requests_total{status=~"5.."}[5m])) / sum by (route) (rate(http_requests_total[5m]))

# p95 latency of the public reads
histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket{route=~"/api/v1/.*"}[5m])))

# how often the trigram tier saves a search
sum(rate(vbh_search_tier_hits_total{tier="fuzzy"}[1h])) / sum(rate(vbh_search_tier_hits_total[1h]))

# an import that is stuck: in progress for long with no progress change
vbh_dictionary_transfer_in_progress == 1 and changes(vbh_dictionary_transfer_progress_percent[10m]) == 0
```

## Logs

The server writes its log to **stdout**, one line per event, and nothing else: where the lines
end up is the process manager's business — `docker compose logs -f server` (Docker keeps them
in `/var/lib/docker/containers/…/*-json.log`), `journalctl -u vocab-bloom-hub-server` under
systemd, pm2's files. `LOG_FORMAT` picks their shape (issue #280):

- **`json`** — the default with `NODE_ENV=production`, so in the Docker images: one JSON object
  per line, what a log collector reads without parsing rules;
- **`pretty`** — the default otherwise (`yarn dev`, the tests): the same lines rendered for a
  terminal, `[10:00:01.234] INFO: [Bootstrap] Server listening on port 3010`.

`LOG_LEVEL` is the minimum level, in Nest's names — `verbose` / `debug` / `log` / `warn` /
`error` / `fatal` (pino's `trace` and `info` are accepted too); `log` by default. Both are read
at start: change them in `.env` and restart the server (`docker compose up -d server` recreates
the container with the new environment).

### What the lines look like

```json
{"level":"info","time":"2026-08-30T10:00:01.234Z","pid":1,"hostname":"a1b2c3d4","context":"Bootstrap","msg":"Server listening on port 3010"}
{"level":"info","time":"2026-08-30T10:00:05.678Z","pid":1,"hostname":"a1b2c3d4","reqId":"6f1c2b3a-…","req":{"id":"6f1c2b3a-…","method":"GET","url":"/api/v1/words/run","remoteAddress":"203.0.113.7","userAgent":"curl/8.7.1"},"res":{"statusCode":200},"responseTime":12,"msg":"GET /api/v1/words/run 200 12ms"}
{"level":"error","time":"2026-08-30T10:00:09.012Z","pid":1,"hostname":"a1b2c3d4","reqId":"9c8d7e6f-…","context":"AllExceptionsFilter","statusCode":500,"err":{"type":"QueryFailedError","message":"…","stack":"QueryFailedError: …\n    at …"},"msg":"Unhandled exception on GET /api/en/words"}
```

| Field                        | What                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `level`                      | `trace` / `debug` / `info` / `warn` / `error` / `fatal` — as a word, not pino's number                                                                                                                                                                                                                                                                                 |
| `time`                       | ISO 8601, UTC                                                                                                                                                                                                                                                                                                                                                          |
| `context`                    | The class that wrote the line (`Bootstrap`, `EnImportDictionaryService`, `AllExceptionsFilter`, …)                                                                                                                                                                                                                                                                     |
| `msg`                        | The message                                                                                                                                                                                                                                                                                                                                                            |
| `req`, `res`, `responseTime` | The **request line**, written once per request when its response has finished: `req.id`, `method`, `url`, `remoteAddress` (the client — from `X-Forwarded-For` behind a proxy with `TRUST_PROXY`), `userAgent`; `res.statusCode`; `responseTime` in milliseconds. At `info`, or `error` when the server answered `5xx`. The probes and the metrics endpoint have none. |
| `reqId`                      | On **every** line written while a request is being handled — the request line, the exception filter, an import that failed in a request — so one id finds all of them                                                                                                                                                                                                  |
| `err`                        | `type`, `message`, `stack` on the errors the server raised itself                                                                                                                                                                                                                                                                                                      |

The **request id** is a UUID generated per request and echoed in the `X-Request-Id` response
header. An `X-Request-Id` that comes in — from the reverse proxy
(`header_up X-Request-Id {http.request.uuid}` in Caddy, `proxy_set_header X-Request-Id $request_id;`
in nginx) or from a client — is reused when it is 1–128 characters of `A-Z a-z 0-9 . _ -`, so
the proxy's access log and the server's lines share one id; anything else is replaced.

Not logged: `GET /api/health`, `GET /api/ready` and `METRICS_PATH` — polled every few seconds.
Never logged: the `Authorization` header, the `Cookie` header (the admin `bearer`), `Set-Cookie`.
The request line carries no headers but the user agent, and pino's redaction masks those three
should a request object ever be logged by hand.

### Reading them

```bash
docker compose logs -f server                                  # as they come
docker compose logs --no-log-prefix server | jq -Rc 'fromjson? | select(.level == "error")'
docker compose logs --no-log-prefix server | jq -Rc 'fromjson? | select(.res.statusCode >= 500) | {time, msg, id: .req.id}'
docker compose logs --no-log-prefix server | jq -Rc 'fromjson? | select(.reqId == "6f1c2b3a-…")'   # everything of one request
docker compose logs --no-log-prefix server | jq -Rc 'fromjson? | select(.responseTime > 1000) | .msg'
journalctl -u vocab-bloom-hub-server -o cat | jq -Rc 'fromjson? | select(.level == "error")'   # native start under systemd
```

(`jq -R … fromjson?` skips the odd non-JSON line, such as a Node warning on stderr.)

### Shipping them to a collector

Nothing in the images or the compose file: a collector reads what Docker already stores. The
usual self-hosted setup is [Grafana Loki](https://grafana.com/oss/loki/) with an agent on the
Docker host — Grafana Alloy discovers the containers through the Docker socket, reads their
stdout and pushes the lines to Loki:

```alloy
discovery.docker "containers" {
  host = "unix:///var/run/docker.sock"
}

discovery.relabel "containers" {
  targets = discovery.docker.containers.targets
  rule {
    source_labels = ["__meta_docker_container_name"]
    regex         = "/(.*)"
    target_label  = "container"
  }
}

loki.source.docker "containers" {
  host       = "unix:///var/run/docker.sock"
  targets    = discovery.relabel.containers.output
  forward_to = [loki.write.default.receiver]
}

loki.write "default" {
  endpoint {
    url = "http://loki:3100/loki/api/v1/push"
  }
}
```

In Grafana the JSON fields become filters: `{container="vocab-bloom-hub-server-1"} | json | level="error"`,
`… | json | res_statusCode >= 500`, `… | json | reqId="6f1c2b3a-…"`. The same lines suit any
collector that reads container stdout (Promtail, Fluent Bit, Vector, Filebeat, the CloudWatch
or Datadog agents), and Docker's own
[logging drivers](https://docs.docker.com/engine/logging/configure/) send them straight from
the daemon — `awslogs`, `gelf`, `syslog`, `fluentd`, or the Loki plugin — through a compose
override or `/etc/docker/daemon.json`, again without touching this repository's files. A native
start under systemd goes through journald, which every collector reads as well.

## Not here yet

A Grafana dashboard and a `docker-compose.observability.yml` (Prometheus + Grafana for local
use) follow once the Docker images of #265 exist. Traces (OpenTelemetry) are out of scope; the
metrics can be re-exported through an OTel collector's Prometheus receiver.
