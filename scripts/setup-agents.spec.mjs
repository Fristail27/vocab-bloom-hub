import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'vbh-agent-setup-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const file of ['.agents/config.json', 'scripts/setup-agents.mjs']) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    copyFileSync(new URL(`../${file}`, import.meta.url), join(root, file));
  }
  return {
    root,
    run: (...args) =>
      spawnSync(process.execPath, [join(root, 'scripts/setup-agents.mjs'), ...args], {
        // Resolve the checkout from the script, even when launched in a subdirectory.
        cwd: join(root, 'scripts'),
        encoding: 'utf8',
      }),
    read: (file) => readFileSync(join(root, file), 'utf8'),
    write: (file, content) => {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), content);
    },
  };
}

function succeeds(result) {
  assert.equal(result.status, 0, result.stderr);
}

test('sets up only selected clients and a repeated setup does not rewrite files', (t) => {
  const f = fixture(t);
  succeeds(f.run('codex', 'gemini', 'codex'));
  assert.deepEqual(readdirSync(f.root).sort(), ['.agents', '.codex', '.gemini', 'scripts']);
  const codex = f.read('.codex/config.toml');
  assert.match(codex, /project_doc_max_bytes = 65536/);
  assert.match(codex, /env_vars = \["CONTEXT7_API_KEY"\]/);
  assert.match(codex, /startup_timeout_sec = 60/);
  assert.deepEqual(JSON.parse(f.read('.gemini/settings.json')).context.fileName, ['AGENTS.md', 'GEMINI.md']);
  const before = statSync(join(f.root, '.codex/config.toml')).mtimeMs;
  succeeds(f.run('codex', 'gemini'));
  assert.equal(statSync(join(f.root, '.codex/config.toml')).mtimeMs, before);
  assert.equal(f.read('.codex/config.toml'), codex);
  assert.deepEqual(readdirSync(join(f.root, '.codex')), ['config.toml']);
});

test('a source change reaches every JSON client in its native format', (t) => {
  const f = fixture(t);
  const config = JSON.parse(f.read('.agents/config.json'));
  config.mcpServers = { fixture: { command: 'fixture-command', args: ['--fixture'] } };
  f.write('.agents/config.json', JSON.stringify(config));
  succeeds(f.run('claude', 'cursor', 'gemini', 'copilot', 'kiro', 'amp', 'opencode'));
  for (const [file, key, typed] of [
    ['.mcp.json', 'mcpServers', true],
    ['.cursor/mcp.json', 'mcpServers', false],
    ['.gemini/settings.json', 'mcpServers', false],
    ['.vscode/mcp.json', 'servers', true],
    ['.kiro/settings/mcp.json', 'mcpServers', false],
    ['.amp/settings.json', 'amp.mcpServers', false],
  ]) {
    const servers = JSON.parse(f.read(file))[key];
    assert.deepEqual(Object.keys(servers), ['fixture']);
    assert.equal(servers.fixture.command, 'fixture-command');
    assert.deepEqual(servers.fixture.args, ['--fixture']);
    assert.equal(servers.fixture.type, typed ? 'stdio' : undefined);
  }
  assert.deepEqual(JSON.parse(f.read('opencode.json')).mcp, {
    fixture: { type: 'local', command: ['fixture-command', '--fixture'], enabled: true },
  });
});

test('a conflict preserves local settings and prevents writes for all requested clients', (t) => {
  const f = fixture(t);
  const local = '// User settings may be JSONC rather than JSON.\n{"theme": "local"}\n';
  f.write('.gemini/settings.json', local);
  const result = f.run('codex', 'gemini');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No files changed/);
  assert.equal(f.read('.gemini/settings.json'), local);
  assert.equal(existsSync(join(f.root, '.codex')), false);
  assert.deepEqual(readdirSync(join(f.root, '.gemini')), ['settings.json']);
});

test('--force keeps an exact backup and never overwrites an earlier backup', (t) => {
  const f = fixture(t);
  f.write('.codex/config.toml', '# Local settings\nmodel = "local-model"\n');
  f.write('.codex/config.toml.bak', 'older backup');
  succeeds(f.run('codex', '--force'));
  assert.equal(f.read('.codex/config.toml.bak'), 'older backup');
  assert.equal(f.read('.codex/config.toml.bak.1'), '# Local settings\nmodel = "local-model"\n');
  assert.match(f.read('.codex/config.toml'), /project_doc_max_bytes = 65536/);
});

test('help and invalid arguments create no client configuration', (t) => {
  const f = fixture(t);
  succeeds(f.run());
  succeeds(f.run('--help'));
  for (const args of [['codex', 'typo'], ['--force'], ['constructor'], ['../outside']]) {
    assert.equal(f.run(...args).status, 1);
  }
  assert.deepEqual(readdirSync(f.root).sort(), ['.agents', 'scripts']);
});

test('even --force refuses to follow a symlink to another config or directory', (t) => {
  const f = fixture(t);
  f.write('shared/config.toml', 'personal settings');
  symlinkSync(join(f.root, 'shared'), join(f.root, '.codex'), 'dir');
  assert.equal(f.run('codex', '--force').status, 1);
  f.write('.cursor/placeholder', '');
  symlinkSync(join(f.root, 'shared/config.toml'), join(f.root, '.cursor/mcp.json'));
  assert.equal(f.run('cursor', '--force').status, 1);
  assert.equal(f.read('shared/config.toml'), 'personal settings');
  assert.deepEqual(readdirSync(join(f.root, 'shared')), ['config.toml']);
});
