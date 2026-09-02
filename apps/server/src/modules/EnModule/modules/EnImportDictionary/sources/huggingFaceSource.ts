import { InternalServerErrorException, Logger } from '@nestjs/common';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import * as path from 'node:path';
import * as os from 'node:os';
import { DatasetManifestT, ImportDictionaryChunkT } from '../../../../../../types';
import { ErrorCodes } from '../../../../../../core/constants/error_codes';
import { DATASET_REFS_URL, datasetBaseUrl, EnDictionaryImportPhasesE, MANIFEST_FILE_NAME } from '../constants';
import { parseManifest } from '../utils/parseManifest';
import type { ImportProgressSink } from '../progress';
import { AcquiredFileT, DatasetSource } from './types';

// A download that receives no byte for this long is abandoned and retried:
// a fetch without a timeout can hang for hours on a half-open connection,
// which an unattended import on first start must not do (issue #268)
export const DOWNLOAD_INACTIVITY_TIMEOUT_MS = 60_000;
export const DOWNLOAD_ATTEMPTS = 3;
const DOWNLOAD_RETRY_DELAY_MS = 5_000;
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** An HTTP 4xx: the file is not there, another attempt would not change that */
class PermanentDownloadError extends Error {}

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

  readManifest(): Promise<DatasetManifestT | null> {
    return fetchPublishedManifest(this.logger, this.options.revision);
  }

  async acquireFile(fileName: string, progress: ImportProgressSink): Promise<AcquiredFileT> {
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
    const filePath = path.join(this.dir, fileName);
    const attempts = this.options.attempts ?? DOWNLOAD_ATTEMPTS;

    for (let attempt = 1; ; attempt++) {
      this.logger.log(`Downloading dataset file "${fileName}"${attempt > 1 ? ` (attempt ${attempt})` : ''}`);
      try {
        await this.download(fileName, filePath, progress);
        return { path: filePath, temporary: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt >= attempts || error instanceof PermanentDownloadError) {
          this.logger.error(
            `Failed to download dataset file "${fileName}" after ${attempt} attempts: ${message}`,
          );
          throw new InternalServerErrorException(ErrorCodes.internal_server_error);
        }
        this.logger.warn(`Download of "${fileName}" failed (${message}), retrying`);
        await rm(filePath, { force: true }).catch(() => {});
        await sleep(this.options.retryDelayMs ?? DOWNLOAD_RETRY_DELAY_MS);
      }
    }
  }

  /** One download attempt; rejects on HTTP errors, network errors and inactivity */
  private async download(fileName: string, filePath: string, progress: ImportProgressSink): Promise<void> {
    const stage = EnDictionaryImportPhasesE.downloading_database;
    const inactivityMs = this.options.inactivityTimeoutMs ?? DOWNLOAD_INACTIVITY_TIMEOUT_MS;
    const controller = new AbortController();
    let nodeStream: Readable | undefined;
    let watchdog: NodeJS.Timeout | undefined;
    const armWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        const reason = new Error(`no data received for ${inactivityMs / 1000} s`);
        controller.abort(reason);
        // the abort ends a real fetch body; destroying the stream ends the
        // pipeline whatever the body implementation does with the signal
        nodeStream?.destroy(reason);
      }, inactivityMs);
    };

    armWatchdog();
    try {
      const response = await fetch(`${datasetBaseUrl(this.options.revision)}/${fileName}`, {
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const message = `HTTP ${response.status}`;
        throw response.status >= 400 && response.status < 500
          ? new PermanentDownloadError(message)
          : new Error(message);
      }

      const bytesTotal = Number(response.headers.get('content-length')) || 0;
      let bytesDownloaded = 0;
      let lastReportedPercent = -1;

      nodeStream = Readable.fromWeb(response.body as any);
      nodeStream.on('data', (chunk: Buffer) => {
        armWatchdog();
        bytesDownloaded += chunk.length;

        if (bytesTotal > 0) {
          const percent = Math.floor((bytesDownloaded / bytesTotal) * 100);
          if (percent === lastReportedPercent) return;
          lastReportedPercent = percent;
        }

        const progressChunk: ImportDictionaryChunkT = {
          percent: bytesTotal > 0 ? Math.floor((bytesDownloaded / bytesTotal) * 100) : 0,
          stage,
          downloaded: bytesDownloaded,
          total: bytesTotal,
        };
        progress.write(progressChunk);
      });

      await pipeline(nodeStream, createWriteStream(filePath));

      progress.write({
        percent: 100,
        stage,
        downloaded: bytesDownloaded,
        total: bytesTotal || bytesDownloaded,
      });
    } catch (error) {
      // an abort surfaces as the reason handed to controller.abort()
      throw controller.signal.aborted && controller.signal.reason instanceof Error
        ? controller.signal.reason
        : error;
    } finally {
      clearTimeout(watchdog);
    }
  }

  async dispose(): Promise<void> {
    await rm(this.dir, { recursive: true, force: true });
  }
}
