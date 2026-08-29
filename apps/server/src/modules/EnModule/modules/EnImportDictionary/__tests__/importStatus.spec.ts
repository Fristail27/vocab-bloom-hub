import { describe, expect, it } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import { ImportTriggerE } from '../../../../../../types';
import { EnDictionaryImportPhasesE } from '../constants';
import { ImportStatusService } from '../importStatus.service';

describe('ImportStatusService — the one import slot (issue #268)', () => {
  it('starts idle and exposes a copy of the status', () => {
    const status = new ImportStatusService();
    expect(status.snapshot()).toEqual({ running: false });
    expect(status.running).toBe(false);
  });

  it('refuses a second import while one holds the slot', () => {
    const status = new ImportStatusService();
    status.begin(ImportTriggerE.manual, 'HuggingFace');
    expect(status.running).toBe(true);
    expect(() => status.begin(ImportTriggerE.auto, 'file "x.zip"')).toThrow(ConflictException);
    status.end({ dataset_version: '1.0.0' });
    expect(() => status.begin(ImportTriggerE.auto, 'file "x.zip"')).not.toThrow();
  });

  it('tracks stage and percent, ignoring the byte counts of the download stage', () => {
    const status = new ImportStatusService();
    status.begin(ImportTriggerE.auto, 'HuggingFace');
    status.progress({
      percent: 42,
      stage: EnDictionaryImportPhasesE.downloading_database,
      downloaded: 42,
      total: 100,
    });
    expect(status.snapshot()).toMatchObject({
      running: true,
      percent: 0,
      stage: EnDictionaryImportPhasesE.downloading_database,
    });
    status.progress({ percent: 12.5, stage: EnDictionaryImportPhasesE.saving_words, datasetVersion: '2.0.0' });
    expect(status.snapshot()).toMatchObject({
      percent: 12.5,
      stage: EnDictionaryImportPhasesE.saving_words,
      dataset_version: '2.0.0',
    });
  });

  it('keeps the outcome of the last import until the next one begins', () => {
    const status = new ImportStatusService();
    status.begin(ImportTriggerE.auto, 'HuggingFace');
    status.progress({ percent: 30, stage: EnDictionaryImportPhasesE.saving_words });
    status.end({ error: 'HTTP 502' });
    expect(status.snapshot()).toMatchObject({
      running: false,
      trigger: ImportTriggerE.auto,
      error: 'HTTP 502',
      percent: 30,
      stage: EnDictionaryImportPhasesE.saving_words,
    });
    expect(status.snapshot().finished_at).toBeDefined();

    status.begin(ImportTriggerE.manual, 'upload "a.zip"');
    expect(status.snapshot()).toMatchObject({ running: true, trigger: ImportTriggerE.manual, percent: 0 });
    expect(status.snapshot().error).toBeUndefined();
    status.end({ dataset_version: '1.2.3' });
    expect(status.snapshot()).toMatchObject({
      running: false,
      percent: 100,
      stage: EnDictionaryImportPhasesE.completed,
      dataset_version: '1.2.3',
    });
  });
});
