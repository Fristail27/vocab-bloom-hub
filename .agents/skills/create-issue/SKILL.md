---
name: create-issue
description: Draft and create a GitHub issue in Fristail27/vocab-bloom-hub using the project's issue templates. Use when asked to file, open or create an issue, bug report or feature request; the argument is a short description of the bug or feature, in any language.
---

Create a GitHub issue in `Fristail27/vocab-bloom-hub` based on the user's request — the text
given with the skill invocation (or the surrounding conversation when nothing was passed).

Follow these steps exactly:

## 1. Pick the template

Read the templates in `.github/ISSUE_TEMPLATE/` (they may have changed) and choose the one matching the request:

- `bug_report.yml` — a bug or unexpected behavior. Title prefix `[Bug]: `, label `bug`.
- `feature_request.yml` — an idea or improvement. Title prefix `[Feature]: `, label `enhancement`.
- `sdk_bug.yml` — an npm-sdk / python-sdk problem. Title prefix `[SDK]: `, labels `sdk`, `bug`.

Blank issues are disabled in this repo — always use a template. If the request is ambiguous between bug and feature, ask the user which one before drafting.

## 2. Draft the content

Write everything in **English** (project convention), regardless of the request language. Fill every field the chosen template defines (dropdown value, required textareas, optional ones when you have the information). Ground the draft in the actual code: read the relevant files first and reference real symbols/paths like `EnImportDictionaryService.importDictionary`. If the request relates to an existing issue, PR, or the current branch, mention it (e.g. `Follow-up to #158`).

For the dropdown fields, map to: `server` (apps/server), `admin` (apps/frontend), `npm-sdk`, `python-sdk`, `docs`.

## 3. Confirm with the user

Show the user the complete draft (title, dropdown value, every field) and ask for confirmation before creating anything. Apply corrections if they have any.

## 4. Create the issue

Prefer the `gh` CLI when it is installed (`which gh`). Issue forms render as `### <Field label>` markdown headings, so reproduce that structure in the body:

```bash
gh issue create \
  --title "[Feature]: <title>" \
  --label enhancement \
  --body "$(cat <<'EOF'
### Target package

server

### Problem

<...>

### Proposed solution

<...>

### Alternatives considered

<...>
EOF
)"
```

(For bug reports use the bug template's labels and field headings: `### Affected package`, `### Description`, `### Steps to reproduce`, `### Expected behavior`, `### Package version`, `### Logs / screenshots`.)

If `gh` is not installed and a browser automation tool is available, use it instead:

1. Open `https://github.com/Fristail27/vocab-bloom-hub/issues/new?template=<template file>` in a new tab.
2. Fill the title and each textarea; set the dropdown by clicking it and choosing the option.
3. Verify all fields are filled (screenshot when the tool can take one), then click **Create**.
4. Confirm the issue page loaded, note the issue number, and close the tab.

Without either, give the user the prefilled URL and the complete body to paste.

## 5. Report back

Reply with the issue number and URL.
