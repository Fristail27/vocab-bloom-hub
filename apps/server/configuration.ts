import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
console.log(111, packageJson.version);

export default () => ({
  version: packageJson.version,
});

export const checkIsPostgres = () => !!process.env.DATABASE_URL;
