import { Logger } from '@nestjs/common';
import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ImportDictionaryChunkT } from '../../../../../../types';
import { EnDictionaryImportPhasesE } from '../constants';
import type { ImportProgressSink } from '../progress';

// A download that receives no byte for this long is abandoned and retried:
// a fetch without a timeout can hang for hours on a half-open connection,
// which an unattended import on first start must not do (issue #268)
export const DOWNLOAD_INACTIVITY_TIMEOUT_MS = 60_000;
export const DOWNLOAD_ATTEMPTS = 3;
const DOWNLOAD_RETRY_DELAY_MS = 5_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** An HTTP 4xx: the file is not there, another attempt would not change that */
export class PermanentDownloadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type DownloadOptionsT = {
  attempts?: number;
  inactivityTimeoutMs?: number;
  retryDelayMs?: number;
  maxBytes?: number;
};

/** Stream a trusted source URL to disk, retrying interrupted transfers from the beginning. */
export async function downloadFile(
  url: string,
  filePath: string,
  logger: Logger,
  progress: ImportProgressSink,
  options: DownloadOptionsT = {},
): Promise<void> {
  const attempts = options.attempts ?? DOWNLOAD_ATTEMPTS;
  for (let attempt = 1; ; attempt++) {
    try {
      await downloadAttempt(url, filePath, progress, options);
      return;
    } catch (error) {
      await rm(filePath, { force: true }).catch(() => undefined);
      const message = error instanceof Error ? error.message : String(error);
      if (attempt >= attempts || error instanceof PermanentDownloadError) {
        logger.error(`Download failed after ${attempt} attempts: ${message}`);
        throw error;
      }
      logger.warn(`Download failed (${message}), retrying`);
      await sleep(options.retryDelayMs ?? DOWNLOAD_RETRY_DELAY_MS);
    }
  }
}

/** One download attempt; rejects on HTTP errors, network errors and inactivity */
async function downloadAttempt(
  url: string,
  filePath: string,
  progress: ImportProgressSink,
  options: DownloadOptionsT,
): Promise<void> {
  const stage = EnDictionaryImportPhasesE.downloading_database;
  const inactivityMs = options.inactivityTimeoutMs ?? DOWNLOAD_INACTIVITY_TIMEOUT_MS;
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
    const response = await fetch(url, {
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      const message = `HTTP ${response.status}`;
      throw response.status >= 400 && response.status < 500
        ? new PermanentDownloadError(message, response.status)
        : new Error(message);
    }

    // fetch decodes Content-Encoding; that header's length describes the wire bytes.
    const encoding = response.headers.get('content-encoding');
    const bytesTotal =
      !encoding || encoding === 'identity' ? Number(response.headers.get('content-length')) || 0 : 0;
    if (options.maxBytes !== undefined && bytesTotal > options.maxBytes) {
      await response.body.cancel();
      throw new PermanentDownloadError('Source file exceeds the download limit', 413);
    }
    let bytesDownloaded = 0;
    let lastReportedPercent = -1;

    nodeStream = Readable.fromWeb(response.body as any);
    nodeStream.on('data', (chunk: Buffer) => {
      armWatchdog();
      bytesDownloaded += chunk.length;
      if (options.maxBytes !== undefined && bytesDownloaded > options.maxBytes) {
        const error = new PermanentDownloadError('Source file exceeds the download limit', 413);
        controller.abort(error);
        nodeStream?.destroy(error);
        return;
      }

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
    if (bytesTotal > 0 && bytesDownloaded !== bytesTotal) throw new Error('Incomplete download');

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
