import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The monorepo carries one version in six files (issue #374); only
// scripts/bump-version.mjs may change it, and this test turns a
// hand-edited, forgotten or drifted field into a red CI instead of a
// release that answers /api/v1/meta with the wrong number
const root = join(__dirname, '../../../..');

const packageVersion = (file: string): string =>
  (JSON.parse(readFileSync(join(root, file), 'utf8')) as { version: string }).version;

describe('the monorepo version (issue #374)', () => {
  it('is the same in every package.json and pyproject.toml', () => {
    const reference = packageVersion('package.json');

    for (const file of [
      'apps/server/package.json',
      'apps/frontend/package.json',
      'apps/site/package.json',
      'packages/npm-sdk/package.json',
    ]) {
      expect({ file, version: packageVersion(file) }).toEqual({ file, version: reference });
    }

    const pyproject = readFileSync(join(root, 'packages/python-sdk/pyproject.toml'), 'utf8');
    const escaped = reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expect(pyproject).toMatch(new RegExp(`^version = "${escaped}"$`, 'm'));
  });
});
