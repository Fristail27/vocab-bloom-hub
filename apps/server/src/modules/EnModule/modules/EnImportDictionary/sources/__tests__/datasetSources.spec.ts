import '../../../../__tests__/helpers/clearDatabaseUrl';

import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, Logger } from '@nestjs/common';

// Extracted archives go under os.tmpdir(); pointing it at a directory private
// to this spec keeps the leftover checks below undisturbed by parallel specs
let mockTmpDir = '';
jest.mock('node:os', () => {
  const actual = jest.requireActual<typeof import('node:os')>('node:os');
  return { ...actual, tmpdir: () => mockTmpDir || actual.tmpdir() };
});

import { mkdtemp, mkdir, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as yazl from 'yazl';

import { ErrorCodes } from '../../../../../../../core/constants/error_codes';
import { DATASET_FILE_NAMES, MANIFEST_FILE_NAME } from '../../constants';
import { DirectoryDatasetSource, validateDatasetDir } from '../directorySource';
import { extractDatasetZip, openZipDatasetSource } from '../zipSource';
import { getImportDir, listImportDir, openImportDirSource, resolveImportPath } from '../importDir';
import { parseManifest } from '../../utils/parseManifest';

const logger = new Logger('datasetSources.spec');

const manifest = {
  version: '0.3.0',
  files: {
    [DATASET_FILE_NAMES.words]: { lines: 1 },
    [DATASET_FILE_NAMES.phrasalVerbs]: { lines: 0 },
    [DATASET_FILE_NAMES.grammarPatterns]: { lines: 0 },
    [DATASET_FILE_NAMES.phrases]: { lines: 0 },
  },
};

// A complete dataset directory in the export format
const writeDataset = async (dir: string, overrides: Record<string, string | null> = {}): Promise<void> => {
  await mkdir(dir, { recursive: true });
  const files: Record<string, string | null> = {
    [MANIFEST_FILE_NAME]: JSON.stringify(manifest),
    [DATASET_FILE_NAMES.words]: '{"word":"run"}\n',
    [DATASET_FILE_NAMES.phrasalVerbs]: '',
    [DATASET_FILE_NAMES.grammarPatterns]: '',
    [DATASET_FILE_NAMES.phrases]: '',
    ...overrides,
  };
  for (const [name, body] of Object.entries(files)) {
    if (body !== null) await writeFile(path.join(dir, name), body);
  }
};

const zipEntries = (zipPath: string, entries: Record<string, string>): Promise<void> =>
  new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile();
    for (const [name, body] of Object.entries(entries)) zip.addBuffer(Buffer.from(body), name);
    const out = createWriteStream(zipPath);
    out.on('close', resolve);
    out.on('error', reject);
    zip.outputStream.pipe(out);
    zip.end();
  });

const rejectsWith = (promise: Promise<unknown>, code: ErrorCodes) =>
  expect(promise).rejects.toThrow(new BadRequestException(code));

describe('dataset sources (issue #269)', () => {
  let root: string;
  const originalImportDir = process.env.DICTIONARY_IMPORT_DIR;

  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'vocab-bloom-sources-'));
    mockTmpDir = root;
  });

  afterAll(async () => {
    mockTmpDir = '';
    await rm(root, { recursive: true, force: true });
  });

  afterEach(() => {
    if (originalImportDir === undefined) delete process.env.DICTIONARY_IMPORT_DIR;
    else process.env.DICTIONARY_IMPORT_DIR = originalImportDir;
  });

  describe('parseManifest', () => {
    it('accepts the export shape and rejects anything else', () => {
      expect(parseManifest(manifest)).toEqual(manifest);
      expect(parseManifest({ ...manifest, synonym_links: 3, antonym_links: 0 })).not.toBeNull();
      expect(parseManifest(null)).toBeNull();
      expect(parseManifest({ files: manifest.files })).toBeNull();
      expect(parseManifest({ version: '1', files: {} })).toBeNull();
      expect(parseManifest({ version: '1', files: { a: { lines: -1 } } })).toBeNull();
      expect(parseManifest({ ...manifest, antonym_links: 'many' })).toBeNull();
    });
  });

  describe('validateDatasetDir', () => {
    it('accepts a complete export directory, ignoring OS junk files, and counts the lines itself', async () => {
      const dir = path.join(root, 'valid');
      // the manifest claims one line; the file holds two plus blank lines
      await writeDataset(dir, { '.DS_Store': 'junk', [DATASET_FILE_NAMES.words]: '{"a":1}\n\n  \n{"b":2}' });
      await expect(validateDatasetDir(dir, logger)).resolves.toEqual({
        ...manifest,
        files: { ...manifest.files, [DATASET_FILE_NAMES.words]: { lines: 2 } },
      });
    });

    it('accepts a dataset whose manifest lists fewer files than the format knows', async () => {
      const dir = path.join(root, 'partial');
      const { [DATASET_FILE_NAMES.phrases]: _p, ...files } = manifest.files;
      await writeDataset(dir, {
        [MANIFEST_FILE_NAME]: JSON.stringify({ ...manifest, files }),
        [DATASET_FILE_NAMES.phrases]: null,
      });
      await expect(validateDatasetDir(dir, logger)).resolves.toMatchObject({ version: '0.3.0' });
    });

    it('accepts a dataset without a manifest — any subset of the jsonl files, version unknown', async () => {
      const dir = path.join(root, 'no-manifest');
      await writeDataset(dir, {
        [MANIFEST_FILE_NAME]: null,
        [DATASET_FILE_NAMES.phrasalVerbs]: null,
        [DATASET_FILE_NAMES.grammarPatterns]: null,
        [DATASET_FILE_NAMES.phrases]: null,
      });
      await expect(validateDatasetDir(dir, logger)).resolves.toEqual({
        version: '',
        files: { [DATASET_FILE_NAMES.words]: { lines: 1 } },
      });
    });

    it('rejects unknown files, a directory without dataset files and a malformed manifest', async () => {
      const unknown = path.join(root, 'unknown');
      await writeDataset(unknown, { 'notes.txt': 'hello' });
      await rejectsWith(validateDatasetDir(unknown, logger), ErrorCodes.dataset_invalid);

      const manifestOnly = path.join(root, 'manifest-only');
      await mkdir(manifestOnly, { recursive: true });
      await writeFile(path.join(manifestOnly, MANIFEST_FILE_NAME), JSON.stringify({ ...manifest, files: {} }));
      await rejectsWith(validateDatasetDir(manifestOnly, logger), ErrorCodes.dataset_invalid);

      const malformed = path.join(root, 'malformed');
      await writeDataset(malformed, { [MANIFEST_FILE_NAME]: '{"version": 1}' });
      await rejectsWith(validateDatasetDir(malformed, logger), ErrorCodes.dataset_invalid);

      // a manifest naming a file that was not copied over is not an error
      const missing = path.join(root, 'missing');
      await writeDataset(missing, { [DATASET_FILE_NAMES.words]: null });
      await expect(validateDatasetDir(missing, logger)).resolves.toMatchObject({ version: '0.3.0' });

      await rejectsWith(validateDatasetDir(path.join(root, 'nope'), logger), ErrorCodes.dataset_invalid);
    });

    it('hands out the files without marking them temporary and reports absent ones as empty', async () => {
      const dir = path.join(root, 'source');
      const { [DATASET_FILE_NAMES.phrases]: _p, ...files } = manifest.files;
      const partial = { ...manifest, files };
      await writeDataset(dir, {
        [MANIFEST_FILE_NAME]: JSON.stringify(partial),
        [DATASET_FILE_NAMES.phrases]: null,
      });
      const source = await DirectoryDatasetSource.open(dir, logger);
      await expect(source.readManifest()).resolves.toEqual(partial);
      await expect(source.acquireFile(DATASET_FILE_NAMES.words)).resolves.toEqual({
        path: path.join(dir, DATASET_FILE_NAMES.words),
        temporary: false,
      });
      await expect(source.acquireFile(DATASET_FILE_NAMES.phrases)).resolves.toEqual({
        path: '',
        temporary: false,
      });
      await source.dispose();
      // the user's directory survives dispose
      expect(existsSync(path.join(dir, DATASET_FILE_NAMES.words))).toBe(true);
    });
  });

  describe('extractDatasetZip', () => {
    const flat = {
      [MANIFEST_FILE_NAME]: JSON.stringify(manifest),
      [DATASET_FILE_NAMES.words]: '{"word":"run"}\n',
      [DATASET_FILE_NAMES.phrasalVerbs]: '',
      [DATASET_FILE_NAMES.grammarPatterns]: '',
      [DATASET_FILE_NAMES.phrases]: '',
    };

    it('extracts a flat archive and one wrapped in a single folder, skipping OS junk', async () => {
      const flatZip = path.join(root, 'flat.zip');
      await zipEntries(flatZip, { ...flat, '__MACOSX/._manifest.json': 'junk' });
      const flatDir = await extractDatasetZip(flatZip, logger);
      expect((await readdir(flatDir)).sort()).toEqual(Object.keys(flat).sort());
      await rm(flatDir, { recursive: true, force: true });

      const wrappedZip = path.join(root, 'wrapped.zip');
      await zipEntries(
        wrappedZip,
        Object.fromEntries(Object.entries(flat).map(([name, body]) => [`export-1/${name}`, body])),
      );
      const source = await openZipDatasetSource(wrappedZip, logger);
      await expect(source.readManifest()).resolves.toEqual(manifest);
      const { path: wordsPath } = await source.acquireFile(DATASET_FILE_NAMES.words);
      expect(existsSync(wordsPath)).toBe(true);
      // the extracted copy is removed with the source
      await source.dispose();
      expect(existsSync(wordsPath)).toBe(false);
    });

    // path traversal inside an archive is refused by yauzl itself (the entry
    // check in extractDatasetZip is a second line of defence), so it is not
    // reproducible with an archive yazl is willing to write
    it('rejects unknown files, nested folders and non-archives, leaving nothing behind', async () => {
      const extracted = async () =>
        (await readdir(path.join(root, 'vocab-bloom-import')).catch(() => [])).filter((n) =>
          n.startsWith('dataset-'),
        );
      const tmpBefore = await extracted();

      const unknown = path.join(root, 'unknown.zip');
      await zipEntries(unknown, { ...flat, 'extra.jsonl': '' });
      await rejectsWith(extractDatasetZip(unknown, logger), ErrorCodes.dataset_invalid);

      const nested = path.join(root, 'nested.zip');
      await zipEntries(nested, { ...flat, [`a/b/${DATASET_FILE_NAMES.words}`]: '' });
      await rejectsWith(extractDatasetZip(nested, logger), ErrorCodes.dataset_invalid);

      const text = path.join(root, 'text.zip');
      await writeFile(text, 'not a zip');
      await rejectsWith(extractDatasetZip(text, logger), ErrorCodes.dataset_invalid);

      // an archive that unpacks fine but fails the directory check is removed too
      const noData = path.join(root, 'no-data.zip');
      await zipEntries(noData, { [MANIFEST_FILE_NAME]: JSON.stringify(manifest) });
      await rejectsWith(openZipDatasetSource(noData, logger), ErrorCodes.dataset_invalid);

      expect(await extracted()).toEqual(tmpBefore);
    });
  });

  describe('import directory (DICTIONARY_IMPORT_DIR)', () => {
    it('is off when the variable is unset or blank', async () => {
      delete process.env.DICTIONARY_IMPORT_DIR;
      expect(getImportDir()).toBeNull();
      expect(getImportDir({ DICTIONARY_IMPORT_DIR: '   ' })).toBeNull();
      await expect(listImportDir()).resolves.toEqual([]);
      await rejectsWith(resolveImportPath('x', logger), ErrorCodes.import_dir_not_configured);
    });

    it('lists archives and dataset directories one level deep', async () => {
      const importDir = path.join(root, 'import-dir');
      await writeDataset(path.join(importDir, 'dataset-a'));
      await mkdir(path.join(importDir, 'not-a-dataset'), { recursive: true });
      await zipEntries(path.join(importDir, 'b.zip'), { [MANIFEST_FILE_NAME]: JSON.stringify(manifest) });
      await writeFile(path.join(importDir, 'readme.txt'), 'ignored');
      process.env.DICTIONARY_IMPORT_DIR = importDir;

      const files = await listImportDir();
      expect(files.map((f) => [f.path, f.kind])).toEqual([
        ['b.zip', 'zip'],
        ['dataset-a', 'directory'],
      ]);
      expect(files[0].size).toBeGreaterThan(0);
    });

    it('opens only paths inside the directory and rejects escapes and other files', async () => {
      const importDir = path.join(root, 'jail');
      await writeDataset(path.join(importDir, 'ds'));
      await writeDataset(path.join(root, 'outside'));
      await symlink(path.join(root, 'outside'), path.join(importDir, 'link'));
      await writeFile(path.join(importDir, 'plain.txt'), '');
      process.env.DICTIONARY_IMPORT_DIR = importDir;

      const source = await openImportDirSource('ds', logger);
      await expect(source.readManifest()).resolves.toEqual(manifest);

      await rejectsWith(openImportDirSource('../outside', logger), ErrorCodes.dataset_file_not_found);
      await rejectsWith(
        openImportDirSource(path.join(root, 'outside'), logger),
        ErrorCodes.dataset_file_not_found,
      );
      await rejectsWith(openImportDirSource('link', logger), ErrorCodes.dataset_file_not_found);
      await rejectsWith(openImportDirSource('missing', logger), ErrorCodes.dataset_file_not_found);
      await rejectsWith(openImportDirSource('plain.txt', logger), ErrorCodes.dataset_file_not_found);
      await rejectsWith(openImportDirSource('', logger), ErrorCodes.dataset_file_not_found);
    });
  });
});
