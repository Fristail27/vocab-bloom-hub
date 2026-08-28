# Observability: Prometheus metrics

The server exposes a Prometheus exposition at `METRICS_PATH` (default `/metrics`) when
`METRICS_ENABLED=true` (issue #281). It answers the two questions an operator has about a
running instance — _can it take my traffic?_ and _why is it slow since yesterday?_ — with
numbers that logs cannot give cheaply: request rate and latency per route, error rate, which
search tier answers, how the dictionary grows, what an import is doing, how busy the Postgres
pool is.

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

## Not here yet

A Grafana dashboard and a `docker-compose.observability.yml` (Prometheus + Grafana for local
use) follow once the Docker images of #265 exist. Traces (OpenTelemetry) are out of scope; the
metrics can be re-exported through an OTel collector's Prometheus receiver.
