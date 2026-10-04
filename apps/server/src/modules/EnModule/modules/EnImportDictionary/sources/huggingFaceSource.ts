import { InternalServerErrorException, Logger } from '@nestjs/common';
import { existsSync, mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import * as os from 'node:os';
import { DatasetManifestT } from '../../../../../../types';
import { ErrorCodes } from '../../../../../../core/constants/error_codes';
import { DATASET_FILE_NAMES, DATASET_REFS_URL, datasetBaseUrl, MANIFEST_FILE_NAME } from '../constants';
import { parseManifest } from '../utils/parseManifest';
import type { ImportProgressSink } from '../progress';
import { AcquiredFileT, DatasetSource } from './types';
import { downloadFile, PermanentDownloadError } from './downloadFile';
export { DOWNLOAD_ATTEMPTS, DOWNLOAD_INACTIVITY_TIMEOUT_MS } from './downloadFile';

const MANIFEST_TIMEOUT_MS = 30_000;

export const getImportTmpDir = (): string => {
  const dir = path.join(os.tmpdir(), 'vocab-bloom-import');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
};

/** Fetches manifest.json from the published dataset; null when unreachable or malformed */
export const fetchPublishedManifest = async (
  logger: Logger,
  revision?: string,
): Promise<DatasetManifestT | null> => {
  try {
    const response = await fetch(`${datasetBaseUrl(revision)}/${MANIFEST_FILE_NAME}`, {
      signal: AbortSignal.timeout(MANIFEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn(`Dataset manifest request failed: HTTP ${response.status}`);
      return null;
    }
    const manifest = parseManifest(await response.json());
    if (!manifest) {
      logger.warn('Dataset manifest has an unexpected shape, ignoring it');
    }
    return manifest;
  } catch (error) {
    logger.warn(
      `Failed to fetch the dataset manifest: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
};

/**
 * The version tags of the dataset repo (issue #322): each published revision
 * is tagged with its manifest.version, so the tags are the pinnable versions.
 * Newest first (HF answers oldest first); [] when the refs API is unreachable.
 */
export const fetchDatasetRevisions = async (logger: Logger): Promise<string[]> => {
  try {
    const response = await fetch(DATASET_REFS_URL, { signal: AbortSignal.timeout(MANIFEST_TIMEOUT_MS) });
    if (!response.ok) {
      logger.warn(`Dataset refs request failed: HTTP ${response.status}`);
      return [];
    }
    const refs = (await response.json()) as { tags?: Array<{ name?: unknown }> };
    return (refs.tags ?? [])
      .map((tag) => tag.name)
      .filter((name): name is string => typeof name === 'string' && name.length > 0)
      .reverse();
  } catch (error) {
    logger.warn(
      `Failed to list the dataset revisions: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
};

/**
 * The published dataset on HuggingFace: every file is downloaded on demand
 * into a directory of its own, so concurrent imports never share files
 */
export class HuggingFaceDatasetSource implements DatasetSource {
  private readonly dir = path.join(getImportTmpDir(), `download-${randomUUID()}`);

  constructor(
    private readonly logger: Logger,
    private readonly options: {
      attempts?: number;
      inactivityTimeoutMs?: number;
      retryDelayMs?: number;
      // a git ref of the dataset repo; undefined imports the moving `main`
      revision?: string;
    } = {},
  ) {}

  // the manifest of the revision, once read; null when it could not be fetched
  private manifest: DatasetManifestT | null | undefined;

  async readManifest(): Promise<DatasetManifestT | null> {
    this.manifest = await fetchPublishedManifest(this.logger, this.options.revision);
    return this.manifest;
  }

  /**
   * A file the revision does not carry is not an error: revisions published
   * before #442 have no collection files, a revision may ship no phrases.
   * The manifest says which files exist, so those are skipped without a
   * request; without a manifest a 404 means the same for every file but the
   * words file — a revision without words is no dataset at all.
   */
  private isAbsent(fileName: string, error: unknown): boolean {
    if (this.manifest) return !(fileName in this.manifest.files);
    return (
      error instanceof PermanentDownloadError && error.status === 404 && fileName !== DATASET_FILE_NAMES.words
    );
  }

  async acquireFile(fileName: string, progress: ImportProgressSink): Promise<AcquiredFileT> {
    if (this.manifest && this.isAbsent(fileName, undefined)) {
      this.logger.log(`Dataset file "${fileName}" is not part of this revision, skipping it`);
      return { path: '', temporary: false };
    }
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
    const filePath = path.join(this.dir, fileName);
    try {
      await downloadFile(
        `${datasetBaseUrl(this.options.revision)}/${this.manifest?.file_names?.[fileName] ?? fileName}`,
        filePath,
        this.logger,
        progress,
        this.options,
      );
      return { path: filePath, temporary: true };
    } catch (error) {
      if (this.isAbsent(fileName, error)) {
        this.logger.log(`Dataset file "${fileName}" is not part of this revision, skipping it`);
        return { path: '', temporary: false };
      }
      throw new InternalServerErrorException(ErrorCodes.internal_server_error);
    }
  }

  async dispose(): Promise<void> {
    await rm(this.dir, { recursive: true, force: true });
  }
}
