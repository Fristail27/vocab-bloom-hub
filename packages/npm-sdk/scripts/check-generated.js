// Fails when src/generated/openapi.ts is behind apps/server/openapi/public-v1.json:
// regenerates into a temporary file and compares the bytes (CI runs this)
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const spec = resolve(root, '../../apps/server/openapi/public-v1.json');
const committed = resolve(root, 'src/generated/openapi.ts');
// inside the package, so prettier applies the repository's configuration
const fresh = resolve(root, 'src/generated/.openapi.fresh.ts');
try {
  execFileSync('yarn', ['exec', 'openapi-typescript', spec, '-o', fresh], { cwd: root, stdio: 'ignore' });
  execFileSync('yarn', ['run', '-T', 'prettier', '--write', fresh], { cwd: root, stdio: 'ignore' });
  if (readFileSync(fresh, 'utf8') !== readFileSync(committed, 'utf8')) {
    console.error(
      `${committed} is stale: run \`yarn workspace @vocab-bloom-hub/client generate\` and commit the result.`,
    );
    process.exit(1);
  }
  console.log(`${committed} is up to date`);
} finally {
  rmSync(fresh, { force: true });
}
