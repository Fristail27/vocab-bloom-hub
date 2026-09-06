# Contributing to Vocab Bloom Hub

First of all, thank you for considering contributing to Vocab Bloom Hub ❤️

We welcome all kinds of contributions, including:

- Bug fixes
- New features
- Documentation improvements
- UI/UX enhancements
- Performance optimizations
- Refactoring
- Tests and tooling

## Getting Started

### 1. Fork the Repository

Create your own fork of the repository on GitHub.

### 2. Clone Your Fork

```bash
git clone https://github.com/Fristail27/vocab-bloom-hub.git
cd vocab-bloom-hub
```

### 3. Install Dependencies

```bash
yarn
```

### 4. Start Development Server

```bash
yarn dev
```

## Project Philosophy

Vocab Bloom Hub aims to be:

- Simple and maintainable
- Beginner-friendly
- Open for collaboration
- Focused on learning and productivity

Please try to keep contributions aligned with these goals.

## Branch Naming

Use descriptive branch names whenever possible.

Examples:

- `feature/add-authentication`
- `fix/mobile-layout`
- `docs/update-readme`

## Commit Messages

Please write clear and meaningful commit messages.

Examples:

- `feat: add spaced repetition algorithm`
- `fix: resolve vocabulary sorting issue`
- `docs: improve installation guide`

## Pull Requests

Before submitting a pull request:

- Ensure the project builds successfully and `yarn check` passes
- Keep PRs focused and minimal
- Avoid unrelated changes in the same PR
- Update documentation if needed

### Documentation languages

The README exists in two languages: `README.md` (English) and `docs/README.ru.md` (Russian).
Any change to one of them must be applied to the other in the same PR so the two stay in sync
section by section. Everything else (`docs/`, code comments, issue and PR templates) is written
in English only.

### Pull Request Checklist

- [ ] Code builds successfully
- [ ] Changes were tested
- [ ] Documentation updated if necessary
- [ ] No unnecessary files included

## Coding Guidelines

Please follow the existing project structure and coding style.

General recommendations:

- Write readable and maintainable code
- Use meaningful variable and function names
- Prefer reusable components
- Avoid unnecessary dependencies
- Keep functions and components small when possible

### Dependencies

- Declare a dependency in the workspace that imports it (`apps/frontend`, `apps/server`, …),
  not at the root; the root holds only the tooling shared by every workspace.
- Peer dependencies must be met. `yarn peers:check` (part of `yarn check`, run in CI) fails
  on any unmet one — Yarn itself only warns. When a package declares a range that lags
  behind the version the monorepo runs and CI exercises the combination anyway, list it in
  `KNOWN_MISMATCHES` in `scripts/check-peer-requirements.mjs` with the reason; the check
  also fails when a listed mismatch is gone, so the list stays current. Yarn's
  `packageExtensions` cannot widen a range a package already declares, which is why the
  exceptions live there.
- Dependabot (`.github/dependabot.yml`) watches every workspace manifest, the Python SDK (uv)
  and the GitHub Actions, grouped per directory into one weekly PR each. A new workspace
  must be added to its `directories` list.

## Reporting Bugs

When creating a bug report, please include:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots if applicable
- Environment information

## Suggesting Features

Feature requests are welcome.

Please describe:

- The problem you are trying to solve
- Your proposed solution
- Possible alternatives

## Code of Conduct

By participating in this project, you agree to follow the
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Releasing

One version covers the whole monorepo; the dataset keeps its own (`manifest.version`). The
full plan of the first release lives in
[#307](https://github.com/Fristail27/vocab-bloom-hub/issues/307); the repeatable part:

1. **The release PR.** Bump the version everywhere with the only tool allowed to touch it —
   `node scripts/bump-version.mjs <version>` (six files; a CI test keeps them equal) — and
   curate the new `CHANGELOG.md` entry (the `/release-changelog <version>` Claude Code command
   in `.claude/commands/` assembles the draft from everything merged since the previous tag).
   Merge on green CI.
2. **The tag — the whole release.** On the merged `main`:
   `git tag -a v<version> -m "..." && git push origin v<version>`.
   The one push does everything: publishes the three Docker images with that version
   (`docker.yml`; a prerelease tag never gets `latest`) and runs
   `.github/workflows/release.yml`, which verifies the tag matches the version, publishes
   `@vocab-bloom-hub/client` to npm and `vocab-bloom-hub` to PyPI via OIDC trusted
   publishing — no tokens — and creates the GitHub Release with generated notes
   (categories in `.github/release.yml`; a hyphen in the tag marks it a prerelease).
   A prerelease publishes to npm under its channel dist-tag (`alpha`, `beta`, …), never
   `latest` — npm refuses a bare `npm publish` of a prerelease version.
   The **first npm publish is manual** (`npm publish --tag <channel>` from `packages/npm-sdk`; npm attaches a
   trusted publisher only to an existing package — configure it right after, workflow
   `release.yml`, environment `npm`, then re-run the failed npm job). PyPI's pending
   publisher covers the first publish.
3. **After the tag**: export the dictionary (the manifest carries the next dataset version),
   upload the revision to HuggingFace and git-tag it there with that version; update
   `VBH_TAG` in `.env.example` / `docs/deployment/docker.md` and the install sections of the
   READMEs.

PyPI normalizes pre-release suffixes per PEP 440 (`0.1.0-alpha.1` is served as `0.1.0a1`) —
cosmetic only, the sources keep the semver spelling. Re-run `uv lock` in
`packages/python-sdk` after a bump so `uv.lock` follows.

The tag push is the point of no return: the npm/PyPI publishes cannot be undone — a bad
release ships a fixed next version instead. Everything before the push is free to redo.

## Questions

If you have questions, feel free to open an Issue or start a Discussion.

## Project Structure

```text
.
├── apps
│   ├── frontend    # Next.js admin UI
│   ├── server      # NestJS API + shared types/constants for the frontend
│   ├── site        # Next.js project website (docs, API reference, playground, word pages)
│   └── e2e         # Playwright browser tests (admin UI and website suites)
├── packages
│   ├── npm-sdk     # @vocab-bloom-hub/client, the Node.js SDK of the public API
│   └── python-sdk  # vocab-bloom-hub, the Python SDK (uv, httpx, pydantic)
├── docs            # deployment, operations, observability, performance, environment, API, authentication, migrations, offline import, data, README.ru.md
├── eslint          # shared ESLint config pieces
├── package.json    # Root workspace configuration
├── tsconfig.base.json
├── tsconfig.json
├── jest.config.ts
├── eslint.config.ts
├── README.md       # English README (Russian version: docs/README.ru.md)
└── yarn.lock
```

Thank you for contributing to Vocab Bloom Hub 🚀
