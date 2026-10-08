# Coding agent setup

Project instructions, skills and shared settings live in one place each:

- [`AGENTS.md`](../AGENTS.md) describes the codebase and the rules for working on it. Read the
  nested `AGENTS.md` before working in `apps/frontend` or `apps/site`; `next dev` regenerates
  those files. The `CLAUDE.md` files only import `@AGENTS.md`.
- [`.agents/skills/`](../.agents/skills/) holds the reusable workflows.
- [`.agents/config.json`](../.agents/config.json) describes the shared MCP servers and the
  few client-specific settings. Change that file when changing the team's setup.

Each client expects its own path and format. Those files are generated locally, ignored by
Git and created only for the clients you select. A fresh clone does not contain a folder
for every supported agent.

## Set up your client

After installing the repository dependencies, run from the repository root:

```bash
yarn agents:setup codex
```

Select several clients when you use more than one:

```bash
yarn agents:setup codex cursor
yarn agents:setup --help
```

| Argument   | Client            | Generated file            |
| ---------- | ----------------- | ------------------------- |
| `codex`    | Codex             | `.codex/config.toml`      |
| `claude`   | Claude Code       | `.mcp.json`               |
| `cursor`   | Cursor            | `.cursor/mcp.json`        |
| `gemini`   | Gemini CLI        | `.gemini/settings.json`   |
| `copilot`  | VS Code / Copilot | `.vscode/mcp.json`        |
| `kiro`     | Kiro              | `.kiro/settings/mcp.json` |
| `amp`      | Amp               | `.amp/settings.json`      |
| `opencode` | OpenCode          | `opencode.json`           |

The script only writes configuration: it does not install a client or launch an MCP server.
It can also run before installing dependencies with `node scripts/setup-agents.mjs codex`.
Start or restart the selected client in the repository root after setup. Follow its normal
workspace trust and MCP approval prompts.

Codex's generated configuration reserves 64 KiB for project instructions and allows 60 seconds
for Context7's cold start. For this repository it uses `approval_policy = "never"` with
`workspace-write` and network access enabled. Commands run without approval prompts inside
that sandbox; protected paths and managed application restrictions still apply. Trust this checkout
so Codex loads the project configuration; start a new session after generating it. See the official OpenAI documentation on
[configuration files](https://learn.chatgpt.com/docs/config-file/config-basic) and
[MCP settings](https://learn.chatgpt.com/docs/extend/mcp).

Gemini's generated settings point `context.fileName` at `AGENTS.md` and `GEMINI.md`, so it reads
the shared instructions without another copy. Setup does not choose a model. The Codex approval
settings above are repository defaults; setup does not change approval policies for other clients.

## Existing files and updates

Rerunning setup leaves identical files untouched. If any requested file differs, the command
stops before writing any configuration. This also protects settings with comments, extra MCP
servers or other personal customizations; the generator does not parse or merge existing files.

After reviewing the differences, regenerate from the shared source with:

```bash
yarn agents:setup codex --force
```

`--force` saves each replaced file beside it as `.bak`, then `.bak.1`, `.bak.2`, and so on without
overwriting earlier backups. Backups are ignored by Git too. Reapply any local customizations
you need from the backup. Symlinked files or parent directories are refused even with `--force`
to avoid changing a configuration outside the checkout.

When updating a checkout that previously tracked per-client settings, run setup again for
the clients you use. When `.agents/config.json` changes, rerun setup to apply the new defaults;
use `--force` if an existing file differs. To stop using a client's project configuration,
remove its generated file after saving any local customizations. The setup command never
removes another client's files or touches global user settings.

The selected clients' folders still exist locally because the clients discover configuration
at those paths. To keep all such configuration outside the checkout, configure the tools in
their own global settings instead, including any project-specific options you need.

## MCP and credentials

The shared source currently defines [Context7](https://github.com/upstash/context7), which
provides current library documentation. Use it when writing code against Next.js, NestJS,
TypeORM, Ant Design, httpx and other dependencies. Its command and arguments are declared once
in `.agents/config.json`; the generator translates them to each client's format.

The first `npx` launch needs network access. `CONTEXT7_API_KEY` is optional; export it in the
environment that launches your client. Never put a key in the shared file. The server's
`env_vars` allowlist and `startup_timeout_sec` are Codex-specific options; other generated
clients retain their usual environment inheritance and startup defaults.

In Codex CLI, `codex mcp list` shows configured servers and `/mcp` shows their session status.
If Context7 cannot connect, report that and use installed library documentation or official
documentation instead.

For clients without an adapter, configure the server through their supported settings or UI
using the command and arguments in `.agents/config.json`.

## Instructions and skills

Keep project rules in `AGENTS.md` and its nested files. Do not copy them into each client's
configuration. Claude Code uses the small `CLAUDE.md` import shims; Gemini is configured by
the setup command. If a client does not discover the instructions, explicitly ask it to read
`AGENTS.md` first.

The skills follow the [Agent Skills](https://agentskills.io) layout
`.agents/skills/<name>/SKILL.md`:

- [`create-issue`](../.agents/skills/create-issue/SKILL.md) creates a GitHub issue using the
  repository's templates.
- [`release-changelog`](../.agents/skills/release-changelog/SKILL.md) assembles the changelog
  entry for a release.

Clients that discover `.agents/skills/` expose these workflows directly. Otherwise, ask the
agent to read and follow the relevant `SKILL.md`, for example "run the create-issue skill".

## First-run checks

```bash
node --version      # 24.9+ for Jest; 22.13+ for running the apps
yarn --version      # the version pinned in package.json
gh --version        # needed by the issue and release skills
uv --version        # needed for Python SDK work
yarn check
```

GitHub work also needs `gh auth status` to succeed. Python SDK work needs `uv sync` inside
`packages/python-sdk`. Browser verification uses the existing Playwright suites (`yarn e2e`
or `yarn e2e:site`), which start their own API and app with isolated test databases.

## Maintaining the setup

Edit `.agents/config.json` for shared server commands or client defaults. The current adapter
supports stdio servers (`command` and `args`), with `env_vars` and `startup_timeout_sec` for Codex.
Keep credentials in the environment. A new transport or client needs an adapter in
[`scripts/setup-agents.mjs`](../scripts/setup-agents.mjs), ignore rules for its output and backups,
and an entry in the table above.

Run `yarn agents:test` after changing the generator. Its tests use temporary checkouts to verify
client selection, shared settings, repeat runs, conflict handling, backups and symlink protection.
They also run in `yarn check` and pull request CI.
