import { InternalServerErrorException, Logger } from '@nestjs/common';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import * as path from 'node:path';
import * as os from 'node:os';
import { type Response } from 'express';
import { DatasetManifestT, ImportDictionaryChunkT } from '../../../../../../types';
import { ErrorCodes } from '../../../../../../core/constants/error_codes';
import { DATASET_BASE_URL, EnDictionaryImportPhasesE, MANIFEST_FILE_NAME } from '../constants';
import { parseManifest } from '../utils/parseManifest';
import { AcquiredFileT, DatasetSource } from './types';

export const getImportTmpDir = (): string => {
  const dir = path.join(os.tmpdir(), 'vocab-bloom-import');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
};

/** Fetches manifest.json from the published dataset; null when unreachable or malformed */
export const fetchPublishedManifest = async (logger: Logger): Promise<DatasetManifestT | null> => {
  try {
    const response = await fetch(`${DATASET_BASE_URL}/${MANIFEST_FILE_NAME}`);
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
 * The published dataset on HuggingFace: every file is downloaded on demand
 * into a directory of its own, so concurrent imports never share files
 */
export class HuggingFaceDatasetSource implements DatasetSource {
  private readonly dir = path.join(getImportTmpDir(), `download-${randomUUID()}`);

  constructor(private readonly logger: Logger) {}

  readManifest(): Promise<DatasetManifestT | null> {
    return fetchPublishedManifest(this.logger);
  }

  async acquireFile(fileName: string, res: Response): Promise<AcquiredFileT> {
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
    const filePath = path.join(this.dir, fileName);
    const stage = EnDictionaryImportPhasesE.downloading_database;

    this.logger.log(`Downloading dataset file "${fileName}"`);

    const response = await fetch(`${DATASET_BASE_URL}/${fileName}`).catch((error: Error) => {
      this.logger.error(`Failed to download dataset file "${fileName}"`, error.stack);
      throw new InternalServerErrorException(ErrorCodes.internal_server_error);
    });
    if (!response.ok || !response.body) {
      this.logger.error(`Failed to download dataset file "${fileName}": HTTP ${response.status}`);
      throw new InternalServerErrorException(ErrorCodes.internal_server_error);
    }

    const bytesTotal = Number(response.headers.get('content-length')) || 0;
    let bytesDownloaded = 0;
    let lastReportedPercent = -1;

    const nodeStream = Readable.fromWeb(response.body as any);

    nodeStream.on('data', (chunk: Buffer) => {
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
      res.write(JSON.stringify(progressChunk) + '\n');
    });

    await pipeline(nodeStream, createWriteStream(filePath));

    const finalChunk: ImportDictionaryChunkT = {
      percent: 100,
      stage,
      downloaded: bytesDownloaded,
      total: bytesTotal || bytesDownloaded,
    };
    res.write(JSON.stringify(finalChunk) + '\n');

    return { path: filePath, temporary: true };
  }

  async dispose(): Promise<void> {
    await rm(this.dir, { recursive: true, force: true });
  }
}
