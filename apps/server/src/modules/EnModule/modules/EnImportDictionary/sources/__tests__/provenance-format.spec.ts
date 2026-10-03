import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DATASET_FILE_NAMES,
  legacyProvenanceFileName,
  DATASET_FORMAT_FILE_NAME,
  LEGACY_PROVENANCE_FILE_NAME,
} from '../../constants';
import { parseManifest, portableManifest } from '../../utils/parseManifest';
import { DirectoryDatasetSource } from '../directorySource';
import { HuggingFaceDatasetSource } from '../huggingFaceSource';

const legacy = DATASET_FILE_NAMES.words;
const physical = legacy;
const manifest = portableManifest({
  version: '2.0',
  provenance_format: 1,
  provenance: {
    title: 'Example',
    notice: 'Keep the terms',
    description: null,
    license_text: null,
    origins: [],
  },
  files: { [legacy]: { lines: 1 } },
});
const logger = new Logger('provenance-format');
const sink = { start() {}, write() {}, end() {} };

afterEach(() => {
  jest.restoreAllMocks();
});

describe('portable provenance format compatibility', () => {
  it('keeps the original JSONL names in the portable manifest', () => {
    expect(manifest).toHaveProperty('files', { 'vocab-bloom-hub-en-words.jsonl': { lines: 1 } });
  });

  it('round-trips its version and resolves only known physical names', () => {
    const injected = {
      ...manifest,
      provenance: { ...(manifest as { provenance: object }).provenance, schema: 'public', own: true },
    };
    expect(parseManifest(injected)?.provenance).not.toHaveProperty('schema');
    expect(parseManifest(injected)?.provenance).not.toHaveProperty('own');
    expect(parseManifest(manifest)).toMatchObject({ version: '2.0', file_names: { [legacy]: physical } });
    // The version-string check in released parsers refuses the envelope.
    expect(typeof (manifest as { version: unknown }).version).not.toBe('string');
    expect(
      parseManifest({
        version: '1',
        files: { [legacy]: { lines: 1 } },
        file_names: { [legacy]: '../../secret' },
      })?.file_names,
    ).toBeUndefined();
    expect(parseManifest({ ...manifest, files: { '../../secret': { lines: 1 } } })).toBeNull();
    expect(parseManifest({ ...manifest, files: { 'manifest.json': { lines: 1 } } })).toBeNull();
    expect(
      parseManifest({
        ...manifest,
        files: { [legacy]: { lines: 1 }, [legacyProvenanceFileName(legacy)]: { lines: 1 } },
      }),
    ).toBeNull();
  });

  it('still opens earlier archives with prefixed files and the earlier marker', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vbh-earlier-export-'));
    const earlierName = legacyProvenanceFileName(legacy);
    try {
      await writeFile(join(dir, earlierName), '{"word":"tree"}\n');
      await writeFile(
        join(dir, 'manifest.json'),
        JSON.stringify({ ...manifest, files: { [earlierName]: { lines: 1 } } }),
      );
      await writeFile(join(dir, LEGACY_PROVENANCE_FILE_NAME), '{"format":1}');
      const source = await DirectoryDatasetSource.open(dir, logger);
      expect(await readFile((await source.acquireFile(legacy)).path, 'utf8')).toContain('tree');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('requires a marker for rich metadata while preserving the original local filenames', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vbh-provenance-format-'));
    try {
      await writeFile(join(dir, physical), '{"word":"tree"}\n');
      await expect(DirectoryDatasetSource.open(dir, logger)).resolves.toBeDefined();
      await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest));
      await expect(DirectoryDatasetSource.open(dir, logger)).rejects.toThrow();
      await writeFile(join(dir, DATASET_FORMAT_FILE_NAME), '{"format":1}');
      const source = await DirectoryDatasetSource.open(dir, logger);
      expect((await source.readManifest()).version).toBe('2.0');
      expect(await readFile((await source.acquireFile(legacy)).path, 'utf8')).toContain('tree');
      await writeFile(join(dir, legacyProvenanceFileName(legacy)), '{"word":"duplicate alias"}\n');
      await expect(DirectoryDatasetSource.open(dir, logger)).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('downloads the original remote filename and reads its source metadata', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const name = String(url).split('/').at(-1);
      if (name === 'manifest.json') return Response.json(manifest);
      return name === physical ? new Response('{"word":"tree"}\n') : new Response('Not found', { status: 404 });
    });
    const current = new HuggingFaceDatasetSource(logger, { attempts: 1 });
    try {
      expect((await current.readManifest())?.version).toBe('2.0');
      expect(await readFile((await current.acquireFile(legacy, sink)).path, 'utf8')).toContain('tree');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/vocab-bloom-hub-en-words.jsonl'),
        expect.any(Object),
      );
    } finally {
      await current.dispose();
    }
  });

  it('requires the complete declared history so a partial upload cannot discard contribution licenses', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vbh-provenance-history-'));
    const history = DATASET_FILE_NAMES.changes;
    try {
      await writeFile(join(dir, physical), '{"word":"tree"}\n');
      await writeFile(
        join(dir, 'manifest.json'),
        JSON.stringify({
          ...manifest,
          files: { [physical]: { lines: 1 }, [history]: { lines: 1 } },
        }),
      );
      await writeFile(join(dir, DATASET_FORMAT_FILE_NAME), '{"format":1}');
      await expect(DirectoryDatasetSource.open(dir, logger)).rejects.toThrow('dataset_invalid');
      await writeFile(join(dir, history), '');
      await expect(DirectoryDatasetSource.open(dir, logger)).rejects.toThrow('dataset_invalid');
      await writeFile(join(dir, history), '{"headword":"tree"}\n');
      await expect(DirectoryDatasetSource.open(dir, logger)).resolves.toBeDefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
