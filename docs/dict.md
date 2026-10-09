# DICT (RFC 2229)

DICT is a separate way to read the instance's dictionaries using the RFC 2229 protocol over
TCP. A dictionary client connects to port **2628** and sends commands such as
`DEFINE default hello`. The server returns text definitions with source and license information.

## How this differs from HTTP

|              | HTTP API                                    | DICT                                     |
| ------------ | ------------------------------------------- | ---------------------------------------- |
| Connection   | HTTP requests to the API URL                | TCP connection to the DICT host and port |
| Example      | `GET /api/v1/words/hello`                   | `DEFINE default hello`                   |
| Response     | JSON                                        | UTF-8 text with DICT status codes        |
| Client       | Browser, `fetch`, HTTP client, project SDKs | DICT client or curl with DICT support    |
| Availability | Existing API settings                       | Off until `DICT_ENABLED=true`            |

The DICT listener runs **inside the existing backend process** (`apps/server`). It does not
require a second application, container or copy of the dictionaries. Both interfaces use the
same installed datasets. Their protocols, ports and enable switches are separate: the HTTP
API continues to work as before, and `PUBLIC_API_ENABLED` does not control DICT.

DICT is not a URL under `/api`: opening `http://localhost:2628` in a browser or calling it with
`fetch()` will not work. Use a client that understands DICT, as shown below.

## Enable and connect

For a server started directly, set:

```dotenv
DICT_ENABLED=true
DICT_HOST=127.0.0.1
DICT_PORT=2628
```

For Docker, set `DICT_ENABLED=true` in `.env` and run the ordinary Compose command:

```bash
docker compose up -d
```

The main Compose file configures DICT in the server container on `0.0.0.0:2628` and
publishes the port on host localhost. `DICT_PORT` in `.env` selects the host port; the
internal port stays 2628. No separate container or additional required variables are needed.
When `DICT_ENABLED=false`, the listener is disabled but the Compose port mapping remains.

A DICT client such as `dict` can connect with:

```bash
dict -h 127.0.0.1 -p 2628 -D
dict -h 127.0.0.1 -p 2628 -d default hello
dict -h 127.0.0.1 -p 2628 -d '*' -s prefix -m hel
```

With a curl build that lists `dict` in `curl --version`:

```bash
curl 'dict://127.0.0.1:2628/d:hello:default'
curl 'dict://127.0.0.1:2628/m:hel:!:prefix'
```

The first request defines `hello` in `default`; the second finds words beginning with `hel`
in the first dictionary that has matches. A missing word is a normal empty lookup, not a
connection failure. Use `SHOW DB` (or `dict -D`) to discover installed database names.

This is plain TCP, not an HTTP route. HTTP reverse-proxy locations and TLS certificates do
not automatically apply. For remote access, expose the TCP port deliberately or use an SSH
port forward/TCP tunnel. The listener has no authentication, SASL, TLS or PROXY-protocol
support. Every installed dataset is public through it, as through the native dataset reads.
Limits use the actual peer IP, not HTTP headers or a proxy-supplied address.

## Databases and definitions

`SHOW DB` lists the installed dataset registry: `default` first, followed by the other dataset
names in ascending order. That order is independent of the active HTTP dataset. The name is
the existing stable dataset name; the short description is its title. Changing a title does
not change its protocol name. A new installation appears on the next command; deleting a
dataset removes it. SQLite exposes only `default`.

`SHOW INFO name` renders the dataset's description, language, source, version, attribution,
notices and full license terms. Existing metadata supplies these values; no additional DICT
metadata is stored. A dataset is a dictionary, not a language identifier. Dictionaries
currently contain English headwords; their translations do not become separate databases.

`DEFINE name word` renders the structured entries as UTF-8 text, one definition per base word
and part of speech. It includes meanings, examples, quotations, translations, forms,
alternatives, etymologies and pronunciations. Recording URLs and their separate license terms
are included as links; no media is downloaded. Word origins and applicable contributions retain
attribution, notices, full custom license text, versions and license relations. Modification
on this instance is disclosed. Missing license metadata is identified, never replaced by the
receiving dataset's license. `SHOW INFO` supplies dataset-level terms separately.

Lookup reuses the native per-dataset headword reader: case-insensitive matching with an exact
case preference when several stored spellings differ only by case, and inflections resolving
to base entries. Alternative-only spellings follow existing EnEntry links one hop. No fuzzy
fallback is applied. `MATCH` returns stored spellings with entries or readable spelling links,
not unrelated thesaurus placeholders. All reads use the dataset's own connection and enter the
same switch gate as HTTP, so a dataset activation waits for an in-flight DICT command.

## Commands and wire format

Supported commands are `DEFINE`, `MATCH`, `SHOW DB`/`SHOW DATABASES`, `SHOW STRAT`/`SHOW STRATEGIES`,
`SHOW INFO`, `SHOW SERVER`, `CLIENT`, `STATUS`, `HELP`, `QUIT`, and `OPTION MIME`.
Command names are case-insensitive. Database names are the exact tokens from `SHOW DB`.
Single/double quoted arguments and backslash escapes support phrases and embedded quotes.

Both lookup commands accept `*` for every database or `!` for the first database with results,
in `SHOW DB` order. `MATCH` implements `exact` and `prefix`, comparing case-folded spelling while
preserving punctuation and whitespace. SQL wildcard characters are literal search characters.
The default strategy `.` uses `exact`. No fuzzy strategies or authentication capabilities are
advertised. Unknown strategies, databases and absent words have distinct protocol errors.

The greeting advertises only `mime` and has a unique message ID. Responses use CRLF. Text blocks
terminate with a single dot; source lines starting with a dot are escaped. `OPTION MIME` applies
to every subsequent text block on that connection, including metadata and match lists. It uses
UTF-8 plain text with 8-bit transfer encoding. Pipelined commands execute in order. Client
half-close drains complete commands; `QUIT` closes cleanly. Shutdown stops acceptance, drains
active work for up to five seconds, sends a shutdown response when possible, and closes sockets
before the imported database modules shut down.

## Limits and configuration

| Setting                | Default     | Meaning                                                                |
| ---------------------- | ----------- | ---------------------------------------------------------------------- |
| `DICT_ENABLED`         | `false`     | Start the TCP listener (`true`/`false`)                                |
| `DICT_HOST`            | `127.0.0.1` | Bind address; Docker Compose sets `0.0.0.0` inside the container       |
| `DICT_PORT`            | `2628`      | TCP port, 1–65535; host port when using Docker Compose                 |
| `DICT_MAX_CONNECTIONS` | `64`        | Total accepted connections, 1–4096                                     |
| `DICT_IDLE_TIMEOUT`    | `60`        | Inactivity timeout in seconds, 1–3600                                  |
| `DICT_RATE_LIMIT`      | `100`       | Commands per peer IP per 60 seconds, 1–10000; shared across reconnects |

There are also fixed bounds: eight simultaneous connections per IP, 32 queued commands per
connection, 1000 matches, 100 definitions, and 1 MiB per response. Oversized result sets return
a temporary error, never a silently truncated successful answer. Refine the prefix or select
one database. These limits are independent of the HTTP rate budget and internal HTTP token.
Rate-limit accounting itself is bounded to 10,000 peer addresses per window.

Command lines accept up to 1024 Unicode characters including CRLF, with a 6144-byte input
buffer. Exceeding the character limit returns a syntax error. Invalid UTF-8 or missing CRLF
closes the session with a syntax error after preceding complete commands. Exceeding the byte
buffer, flooding the queue, or hitting connection/rate limits produces a temporary error and
closes the connection. Text
output wraps long lines to the protocol limit, accounting for dot escaping and CRLF without
splitting Unicode characters. Machine-readable list rows are never wrapped into invalid rows.

The implementation follows [RFC 2229](https://www.rfc-editor.org/rfc/rfc2229.html). Automated
checks use isolated TCP clients and original SQLite/Postgres fixtures, including inactive
databases, switching, framing, Unicode, MIME, pipelining, shutdown and resource limits.
