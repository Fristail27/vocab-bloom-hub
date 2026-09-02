# Security Policy

## Supported versions

The project has not shipped a versioned release yet. Security fixes land on `main` and in the
`main`-tagged Docker images (`ghcr.io/fristail27/vocab-bloom-hub-*`). Once releases start, this
table will name the supported lines.

| Version                       | Supported |
| ----------------------------- | --------- |
| `main` (images tagged `main`) | ✅        |

## Reporting a vulnerability

Please **do not open a public issue** for anything you believe is a security problem.

Use GitHub's private vulnerability reporting instead: **Security → Report a vulnerability** on
this repository ([direct link](https://github.com/Fristail27/vocab-bloom-hub/security/advisories/new)).
The report reaches the maintainer privately, and the discussion and fix stay private until a
coordinated disclosure.

What helps: the affected endpoint or component, reproduction steps, and the impact you see.
You can expect an acknowledgement within a week. Please give the project a reasonable window
to ship a fix before disclosing publicly.

## Scope notes

- The admin API and UI are a **single-admin, trusted-operator** surface by design: there is no
  user separation to escalate between. Reports about the public `/api/v1` surface, the
  authentication flow, rate-limit bypasses, or the import pipeline (untrusted archives) are
  the most valuable.
- Denial of service through the documented rate limits' sheer generosity is a configuration
  topic, not a vulnerability; bypassing the limits is one.
- The bundled `docker-compose.yml` defaults (local Postgres, no TLS) are a development
  convenience; production hardening is documented in `docs/deployment/`.
