// Exercise Compose's actual profile/interpolation rules without reading the operator's .env.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repo = fileURLToPath(new URL('../', import.meta.url));
function config(values, build = false) {
  const dir = mkdtempSync(join(tmpdir(), 'vbh-semantic-compose-'));
  const envFile = join(dir, '.env');
  writeFileSync(
    envFile,
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
  );
  // Shell variables override --env-file. Remove deployment settings inherited by this test.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
      /^(PATH|HOME|DOCKER_.*|XDG_.*|TMPDIR|SYSTEMROOT)$/i.test(key),
    ),
  );
  try {
    return JSON.parse(
      execFileSync(
        'docker',
        [
          'compose',
          '--project-name',
          'vbh-semantic-config',
          '--project-directory',
          repo,
          '--env-file',
          envFile,
          '-f',
          join(repo, 'docker-compose.yml'),
          ...(build ? ['-f', join(repo, 'docker-compose.build.yml')] : []),
          'config',
          '--format',
          'json',
        ],
        { env: { ...env, ENV_FILE: envFile }, encoding: 'utf8' },
      ),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
for (const profile of ['', 'db', 'db,embeddings', 'db,site,embeddings']) {
  for (const enabled of ['false', 'true']) {
    test(`profile=${profile || '(none)'}, search=${enabled}: independent startup`, () => {
      const { services } = config({ COMPOSE_PROFILES: profile, SEMANTIC_SEARCH_ENABLED: enabled });
      assert.equal(Boolean(services.embeddings), profile.includes('embeddings'));
      assert.equal(Boolean(services.postgres), profile.includes('db'));
      assert.equal(services.server.environment.SEMANTIC_SEARCH_ENABLED, enabled);
      assert.equal(services.server.environment.EMBEDDINGS_URL, 'http://embeddings:11434');
      assert.equal(services.server.depends_on, undefined);
      if (services.embeddings) {
        assert.equal(services.embeddings.ports, undefined);
        assert.equal(services.embeddings.volumes[0].target, '/root/.ollama');
        assert.match(services.embeddings.healthcheck.test[1], /ollama show/);
      }
    });
  }
}
test('unset flag stays off with the model profile; image/model/revision are separate settings', () => {
  const { services } = config({
    COMPOSE_PROFILES: 'embeddings',
    EMBEDDINGS_IMAGE: 'ollama/ollama:fixture',
    EMBEDDINGS_MODEL: 'fixture:latest',
    EMBEDDINGS_REVISION: 'a'.repeat(64),
    EMBEDDINGS_DIMENSIONS: '3',
  });
  assert.equal(services.server.environment.SEMANTIC_SEARCH_ENABLED, 'false');
  assert.equal(services.embeddings.image, 'ollama/ollama:fixture');
  assert.equal(services.embeddings.environment.EMBEDDINGS_MODEL, 'fixture:latest');
  assert.equal(services.server.environment.EMBEDDINGS_REVISION, 'a'.repeat(64));
  assert.equal(services.server.environment.EMBEDDINGS_DIMENSIONS, '3');
});
test('remote model/database need neither local service, including the build overlay', () => {
  for (const build of [false, true]) {
    const { services } = config(
      {
        COMPOSE_PROFILES: '',
        SEMANTIC_SEARCH_ENABLED: 'true',
        EMBEDDINGS_URL: 'http://192.0.2.106:11434',
        DATABASE_URL: 'postgres://fixture@db.example/dictionary',
      },
      build,
    );
    assert.equal(services.embeddings, undefined);
    assert.equal(services.postgres, undefined);
    assert.equal(services.server.environment.EMBEDDINGS_URL, 'http://192.0.2.106:11434');
    assert.equal(services.server.environment.DATABASE_URL, 'postgres://fixture@db.example/dictionary');
  }
});
