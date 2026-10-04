// Guard the temporary Next.js ESLint glob replacement against API differences
// and plugin upgrades. Remove with the resolution and patch once upstream
// drops the vulnerable braces dependency (GHSA-vfj7-8cjw-p6xm).
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { getRootDirs } = require('@next/eslint-plugin-next/dist/utils/get-root-dirs.js');
const nextPlugin = require('@next/eslint-plugin-next');
const { Linter } = require('eslint');

test('Next.js ESLint resolves app roots and still checks internal links', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'vbh-next-eslint-'));
  const previous = process.cwd();
  try {
    for (const name of ['frontend', 'site', 'server']) {
      mkdirSync(join(fixture, 'apps', name), { recursive: true });
    }
    mkdirSync(join(fixture, 'apps/site/pages'));
    writeFileSync(join(fixture, 'apps/site/pages/about.js'), '');
    writeFileSync(join(fixture, 'apps/not-a-directory'), 'fixture');
    process.chdir(fixture);

    // The rule uses roots as filesystem paths. Compare their targets,
    // allowing relative paths, directory slashes and macOS /var symlinks.
    const targets = (paths) => paths.map((path) => realpathSync(path)).sort();
    for (const [rootDir, expected] of [
      [undefined, [fixture]],
      ['apps/site', ['apps/site']],
      ['apps/*', ['apps/frontend', 'apps/server', 'apps/site']],
      ['apps/{frontend,site}', ['apps/frontend', 'apps/site']],
      [
        ['apps/frontend', 'apps/site'],
        ['apps/frontend', 'apps/site'],
      ],
      ['apps\\site', ['apps/site']],
      [join(fixture, 'apps/site'), [join(fixture, 'apps/site')]],
      ['missing/*', []],
    ]) {
      const actual = getRootDirs({ cwd: fixture, settings: { next: { rootDir } } });
      assert.deepEqual(targets(actual), targets(expected), JSON.stringify(rootDir));
    }

    const linter = new Linter({ cwd: fixture });
    const config = {
      languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { '@next/next': nextPlugin },
      settings: { next: { rootDir: 'apps/{frontend,site}' } },
      rules: { '@next/next/no-html-link-for-pages': 'error' },
    };
    const messages = linter.verify('const link = <a href="/about">About</a>;', config);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, '@next/next/no-html-link-for-pages');
    const external = linter.verify('const link = <a href="https://example.com">External</a>;', config);
    assert.equal(external.length, 0);
  } finally {
    process.chdir(previous);
    rmSync(fixture, { recursive: true, force: true });
  }
});
