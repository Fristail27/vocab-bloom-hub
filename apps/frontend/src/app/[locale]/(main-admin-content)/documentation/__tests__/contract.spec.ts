import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOCUMENTED_ENDPOINTS } from '../constants';

// The page hardcodes its endpoint list while the site and the SDKs derive
// theirs from the committed spec — this is the tie that kept them in sync
// missing here (issue #349): the descriptors must cover exactly the
// operations of apps/server/openapi/public-v1.json
describe('documentation contract', () => {
  const specPath = join(__dirname, '../../../../../../../..', 'apps/server/openapi/public-v1.json');
  const spec = JSON.parse(readFileSync(specPath, 'utf8')) as {
    paths: Record<string, Record<string, unknown>>;
  };

  it('documents every operation of the public spec, and nothing else', () => {
    const specOperations = Object.entries(spec.paths)
      .flatMap(([path, methods]) => Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`))
      .sort();
    const documented = DOCUMENTED_ENDPOINTS.map(({ method, path }) => `${method} ${path}`).sort();

    expect(documented).toEqual(specOperations);
  });
});
