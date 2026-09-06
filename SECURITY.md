# Security Policy

## Supported versions

The project is on its `0.x` prereleases (the `0.1.0` alphas, next the `0.2.0` betas). Security
fixes land on `main` and ship in the next release — there are no backports: the supported
release is the **latest one** (Docker images on GHCR, `@vocab-bloom-hub/client` on npm,
`vocab-bloom-hub` on PyPI).

| Version                                                                                         | Supported |
| ----------------------------------------------------------------------------------------------- | --------- |
| the latest release (see the [releases](https://github.com/Fristail27/vocab-bloom-hub/releases)) | ✅        |
| `main` (images tagged `main`)                                                                   | ✅        |
| older releases                                                                                  | ❌        |

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
- Every pull request audits the dependency trees (`yarn npm audit` over all workspaces with
  transitive packages, `pip-audit` for the Python SDK) for advisories of high severity and
  above; Dependabot proposes the upgrades weekly.
