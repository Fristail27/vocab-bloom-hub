import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import en from '../../../../../../messages/en';
import ru from '../../../../../../messages/ru';
import { DOCUMENTED_ENDPOINTS } from '../constants';

// A key referenced by a component but absent from the messages only shows up as
// a MISSING_MESSAGE error at render time, so the descriptors are checked here
const LOCALES = { en, ru };

describe.each(Object.entries(LOCALES))('documentation messages (%s)', (_locale, messages) => {
  const documentation = messages.documentation as Record<string, string>;

  it('переводит название и описание каждого метода', () => {
    DOCUMENTED_ENDPOINTS.forEach(({ key }) => {
      expect(documentation[`endpoint_${key}`]).toBeTruthy();
      expect(documentation[`desc_${key}`]).toBeTruthy();
    });
  });

  it('переводит описание каждого параметра', () => {
    DOCUMENTED_ENDPOINTS.flatMap(({ params }) => params).forEach(({ name }) => {
      expect(documentation[`param_desc_${name}`]).toBeTruthy();
    });
  });

  it('содержит пункт меню', () => {
    expect((messages.menu as Record<string, string>).documentation).toBeTruthy();
  });
});

const COMPONENTS_DIR = join(__dirname, '..', '_components');

const collectTsxFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) return entry === '__tests__' ? [] : collectTsxFiles(path);

    return path.endsWith('.tsx') ? [path] : [];
  });

// Only literal calls: keys built from a descriptor are covered by the checks above
const collectLiteralKeys = (source: string): string[] =>
  [...source.matchAll(/\bt\('([a-zA-Z_]+)'\s*[,)]/g)].map(([, key]) => key);

describe('documentation messages', () => {
  it('совпадают по набору ключей в en и ru', () => {
    expect(Object.keys(ru.documentation).sort()).toEqual(Object.keys(en.documentation).sort());
  });

  it('содержат каждый ключ, который компоненты запрашивают напрямую', () => {
    const usedKeys = collectTsxFiles(COMPONENTS_DIR).flatMap((file) =>
      collectLiteralKeys(readFileSync(file, 'utf8')),
    );

    expect(usedKeys.length).toBeGreaterThan(0);
    usedKeys.forEach((key) => {
      expect(en.documentation).toHaveProperty(key);
    });
  });
});
