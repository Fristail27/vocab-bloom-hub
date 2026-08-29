import { describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ImportDictionaryChunkT } from '../../../../../../types';
import { EnDictionaryImportPhasesE } from '../constants';
import { HttpImportProgressSink, LogImportProgressSink } from '../progress';

describe('import progress sinks (issue #268)', () => {
  it('HttpImportProgressSink streams NDJSON on the response with the streaming headers', () => {
    const res = { setHeader: jest.fn(), write: jest.fn(), end: jest.fn() } as unknown as Response;
    const sink = new HttpImportProgressSink(res);
    sink.start();
    sink.write({ percent: 50, stage: EnDictionaryImportPhasesE.saving_words });
    sink.end();
    expect(res.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    expect(res.setHeader).toHaveBeenCalledWith('Transfer-Encoding', 'chunked');
    expect(res.write).toHaveBeenCalledWith(JSON.stringify({ percent: 50, stage: 0 }) + '\n');
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('LogImportProgressSink logs stage changes and every step of percent, forwarding every chunk', () => {
    const logger = { log: jest.fn() } as unknown as Logger;
    const seen: ImportDictionaryChunkT[] = [];
    const sink = new LogImportProgressSink(logger, 'Auto import', (chunk) => seen.push(chunk), 10);
    sink.start();
    sink.write({ percent: 0, stage: EnDictionaryImportPhasesE.downloading_database, downloaded: 0, total: 10 });
    sink.write({
      percent: 50,
      stage: EnDictionaryImportPhasesE.downloading_database,
      downloaded: 5,
      total: 10,
    });
    sink.write({ percent: 1, stage: EnDictionaryImportPhasesE.saving_words });
    sink.write({ percent: 5, stage: EnDictionaryImportPhasesE.saving_words });
    sink.write({ percent: 11, stage: EnDictionaryImportPhasesE.saving_words });
    sink.write({ percent: 12, stage: EnDictionaryImportPhasesE.linking_synonyms });
    sink.write({ percent: 100, stage: EnDictionaryImportPhasesE.completed });
    sink.end();

    const lines = (logger.log as jest.Mock).mock.calls.map((c) => c[0]);
    expect(lines).toEqual([
      'Auto import: started',
      'Auto import: downloading the dataset',
      'Auto import: saving words 1%',
      'Auto import: saving words 11%',
      'Auto import: linking synonyms 12%',
      'Auto import: completed 100%',
      'Auto import: finished',
    ]);
    expect(seen).toHaveLength(7);
  });
});
