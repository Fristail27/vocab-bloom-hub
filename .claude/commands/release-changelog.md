---
description: Assemble the curated CHANGELOG entry for a release from everything merged since the previous tag
argument-hint: <version, e.g. 0.2.0-beta.1>
---

Assemble the `CHANGELOG.md` entry for release version $ARGUMENTS of vocab-bloom-hub. This is the
curation step of the release PR (CONTRIBUTING.md#releasing): the command drafts, the human reviews —
never write the file before the draft is confirmed.

Follow these steps exactly:

## 1. Collect what shipped

- Find the previous release tag: `git fetch --tags --quiet && git describe --tags --abbrev=0 origin/main`.
- Collect everything merged since it: `git log --oneline --first-parent <prev-tag>..origin/main` for the
  merge list, and `gh pr view <number> --json title,body,labels` for any PR whose one-line title is not
  enough to judge. Include the changes already sitting on the current branch, if any.
- Note the tag date of the previous release: `git log -1 --format=%ad --date=format:%Y-%m-%d <prev-tag>`.

## 2. Filter out non-release noise

Drop what a reader of the release notes does not care about: dependency bumps with no user-visible
effect (dependabot), CI/workflow-only changes, fixes to things that never shipped, and anything already
covered by a previous entry. Keep everything user-visible — features, behavior changes, notable fixes,
documentation worth announcing. When in doubt, keep it and let the review decide.

## 3. Draft the entry in the established style

Read the top of `CHANGELOG.md` and match it exactly:

- Section header `## v$ARGUMENTS — unreleased`, inserted above the previous release's section.
- One short theme sentence first — what this release is about, not a list.
- Then curated bullets of the form `- **Area**: what changed, written for a reader of the release` —
  reader-facing sentences, not commit messages; no PR numbers; group related changes into one bullet.
- Wrap lines at ~100 characters like the rest of the file.
- If the previous section still says `— unreleased` but its tag exists, replace `unreleased` with the
  tag date from step 1 (the recipe dates a section in the _next_ release PR).

## 4. Review before writing

Show the complete draft (the new section plus any dating change) and wait for confirmation. Apply
corrections, then edit `CHANGELOG.md`. Do not commit unless asked.

## 5. Remind the rest of the release PR

The changelog is one third of the release PR. After writing, remind that the same PR needs
`node scripts/bump-version.mjs $ARGUMENTS` (the only tool allowed to touch the version),
`yarn workspace server openapi:generate`, and `uv lock` in `packages/python-sdk` — and that after the
merge the release is one tag push: `git tag -a v$ARGUMENTS && git push origin v$ARGUMENTS`.
