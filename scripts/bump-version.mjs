#!/usr/bin/env node
// The only way the monorepo version changes (issue #374): one command bumps
// every version field together, so no file can be forgotten. A jest test
// (apps/server/src/__tests__/version-sync.spec.ts) fails CI when the six
// fields disagree. Usage:
//
//   node scripts/bump-version.mjs 0.1.0-alpha.1
//
// The release flow around it is documented in CONTRIBUTING.md#releasing.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const PACKAGE_JSON_FILES = [
  'package.json',
  'apps/server/package.json',
  'apps/frontend/package.json',
  'apps/site/package.json',
  'packages/npm-sdk/package.json',
];
const PYPROJECT_FILE = 'packages/python-sdk/pyproject.toml';

// the official semver pattern (semver.org), anchored
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const version = process.argv[2];
if (!version || !SEMVER.test(version)) {
  console.error(`Usage: node scripts/bump-version.mjs <semver>\n"${version ?? ''}" is not a valid semver.`);
  process.exit(1);
}

for (const file of PACKAGE_JSON_FILES) {
  const path = join(root, file);
  const source = readFileSync(path, 'utf8');
  const updated = source.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`);
  if (updated === source) {
    console.error(`No "version" field found in ${file}`);
    process.exit(1);
  }
  writeFileSync(path, updated);
  console.log(`${file} → ${version}`);
}

{
  const path = join(root, PYPROJECT_FILE);
  const source = readFileSync(path, 'utf8');
  const updated = source.replace(/^(version\s*=\s*")[^"]+(")/m, `$1${version}$2`);
  if (updated === source) {
    console.error(`No version line found in ${PYPROJECT_FILE}`);
    process.exit(1);
  }
  writeFileSync(path, updated);
  console.log(`${PYPROJECT_FILE} → ${version}`);
}

console.log(`\nDone. Next: update CHANGELOG.md, commit, and tag v${version} on main after the merge.`);
