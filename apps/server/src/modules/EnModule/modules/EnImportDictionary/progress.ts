import { Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ImportDictionaryChunkT } from '../../../../../types';
import { EnDictionaryImportPhasesE } from './constants';

/**
 * Where the import pipeline reports its progress (issue #268). The admin
 * UI reads an NDJSON stream on the HTTP response; the automatic import on
 * first start has no request and reports to the log instead. The pipeline
 * itself only ever sees this interface.
 */
export interface ImportProgressSink {
  /** Called once before the first chunk */
  start(): void;
  write(chunk: ImportDictionaryChunkT): void;
  /** Called once after the last chunk, on success only */
  end(): void;
}

/** The NDJSON progress stream of the admin endpoints, one JSON object per line */
export class HttpImportProgressSink implements ImportProgressSink {
  constructor(private readonly res: Response) {}

  start(): void {
    this.res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    this.res.setHeader('Transfer-Encoding', 'chunked');
    // nginx honours this on its own; the stream must reach the browser as it is produced
    this.res.setHeader('X-Accel-Buffering', 'no');
  }

  write(chunk: ImportDictionaryChunkT): void {
    this.res.write(JSON.stringify(chunk) + '\n');
  }

  end(): void {
    this.res.end();
  }
}

/**
 * Progress in the server log: one line per stage change and one every
 * `stepPercent` of the total, so a ten-minute import leaves a readable trail
 * rather than thousands of lines. `onChunk` forwards every chunk unfiltered
 * (the import status the readiness probe and the admin banner read).
 */
export class LogImportProgressSink implements ImportProgressSink {
  private lastStage: EnDictionaryImportPhasesE | undefined;
  private lastLoggedPercent = -Infinity;

  constructor(
    private readonly logger: Logger,
    private readonly label: string,
    private readonly onChunk?: (chunk: ImportDictionaryChunkT) => void,
    private readonly stepPercent = 10,
  ) {}

  start(): void {
    this.logger.log(`${this.label}: started`);
  }

  write(chunk: ImportDictionaryChunkT): void {
    this.onChunk?.(chunk);
    const stageChanged = chunk.stage !== undefined && chunk.stage !== this.lastStage;
    if (stageChanged) {
      this.lastStage = chunk.stage;
      this.lastLoggedPercent = -Infinity;
    }
    // the download stage reports its own bytes; the overall percent belongs to the other stages
    if (chunk.stage === EnDictionaryImportPhasesE.downloading_database) {
      if (stageChanged) this.logger.log(`${this.label}: downloading the dataset`);
      return;
    }
    const percent = Math.floor(chunk.percent);
    if (!stageChanged && percent < this.lastLoggedPercent + this.stepPercent) return;
    this.lastLoggedPercent = percent;
    const stage =
      chunk.stage === undefined ? '' : ` ${EnDictionaryImportPhasesE[chunk.stage].replace(/_/g, ' ')}`;
    this.logger.log(`${this.label}:${stage} ${percent}%`);
  }

  end(): void {
    this.logger.log(`${this.label}: finished`);
  }
}
