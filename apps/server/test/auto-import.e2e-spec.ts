import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/modules/AppModule/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { DictionaryBootstrapService } from '../src/modules/EnModule/modules/EnImportDictionary/dictionaryBootstrap.service';
import { ImportStatusService } from '../src/modules/EnModule/modules/EnImportDictionary/importStatus.service';
import { DATASET_VERSION_SETTINGS_FIELD } from '../src/modules/EnModule/modules/EnImportDictionary/constants';
import { SettingsService } from '../src/modules/SettingsModule/settings.service';
import { hashLoginString } from '../core/utils/crypto';
import { createJwt } from '../core/utils/auth';
import { EnPartOfSpeechE, ImportTriggerE } from '../types';

const ENV_KEYS = ['DICTIONARY_AUTO_IMPORT', 'DICTIONARY_IMPORT_DIR'] as const;

const datasetWord = (word: string) => ({
  word,
  part_of_speech: EnPartOfSpeechE.noun,
  area_variant: '',
  generated_by_model: '',
  generated: false,
  verb___phrasal_object_pattern: '',
  verb___transitivity: '',
  language_register: '',
  categories: [],
  verb___is_phrasal: false,
  verb___is_irregular: false,
  noun___is_proper: false,
  word_level: '',
  description: '',
  transcription: '',
  is_obsolete: false,
  version: '9.9.9',
  is_abbreviation: false,
  noun___uncountable: false,
  noun___irregular_plural: false,
  noun___always_plural: false,
  base_phrasal: '',
  phrasal_variants: [],
  forms: [],
  short_translations: [],
  meanings: [],
});

/**
 * The automatic import on first start (issue #268): with
 * DICTIONARY_AUTO_IMPORT on, an instance without a recorded dataset version
 * loads the dictionary by itself — here from a dataset in
 * DICTIONARY_IMPORT_DIR, which is what an offline installation does — and
 * never repeats it once the version is recorded.
 */
describe('Automatic dictionary import (e2e, issue #268)', () => {
  let app: INestApplication<App>;
  let importDir: string;
  const auth = { Authorization: '' };
  const server = () => app.getHttpServer();
  const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  const boot = async () => {
    process.env.ADMIN_USERNAME = 'e2e-admin';
    process.env.ADMIN_PASSWORD = 'e2e-password';
    const hashByEnv = await hashLoginString('e2e-admin', 'e2e-password');
    const secretHash = await hashLoginString('e2e-admin', hashByEnv);
    auth.Authorization = `Bearer ${createJwt({ role: 'admin' }, secretHash + hashByEnv)}`;
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost).httpAdapter));
    await app.init();
  };

  const waitForImport = async () => {
    const status = app.get(ImportStatusService);
    for (let i = 0; i < 200 && (status.running || !status.snapshot().finished_at); i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return status.snapshot();
  };

  beforeAll(async () => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    importDir = await mkdtemp(path.join(os.tmpdir(), 'vbh-auto-import-'));
    const dataset = path.join(importDir, 'seed');
    await mkdir(dataset);
    await writeFile(
      path.join(dataset, 'vocab-bloom-hub-en-words.jsonl'),
      [datasetWord('sprint'), datasetWord('run')].map((w) => JSON.stringify(w)).join('\n') + '\n',
    );
    await writeFile(
      path.join(dataset, 'manifest.json'),
      JSON.stringify({
        version: '9.9.9',
        generatedAt: new Date().toISOString(),
        files: { 'vocab-bloom-hub-en-words.jsonl': { lines: 2 } },
      }),
    );
    process.env.DICTIONARY_AUTO_IMPORT = 'true';
    process.env.DICTIONARY_IMPORT_DIR = importDir;
  });

  afterEach(async () => {
    await app?.close();
  });

  afterAll(async () => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    await rm(importDir, { recursive: true, force: true });
  });

  it('loads the dataset from DICTIONARY_IMPORT_DIR on first start and records its version', async () => {
    await boot();
    const status = await waitForImport();
    expect(status).toMatchObject({
      running: false,
      trigger: ImportTriggerE.auto,
      label: 'file "seed"',
      percent: 100,
      dataset_version: '9.9.9',
    });
    expect(status.error).toBeUndefined();

    // the dictionary is there, the version is recorded, the probe is green again
    await request(server()).get('/api/v1/words/sprint').expect(200);
    const meta = await request(server()).get('/api/v1/meta').expect(200);
    expect(meta.body.data.dataset_version).toBe('9.9.9');
    await request(server()).get('/api/ready').expect(200);
    const shown = await request(server()).get('/api/en/dictionary/import/status').set(auth).expect(200);
    expect(shown.body).toMatchObject({ running: false, trigger: 'auto', dataset_version: '9.9.9' });
  });

  it('does nothing on a start with a recorded dataset version', async () => {
    await boot();
    await waitForImport();
    // the sqlite database is per application here, so record the version by hand
    await app.close();
    await boot();
    await app.get(SettingsService).upsert(DATASET_VERSION_SETTINGS_FIELD, '9.9.9');
    await expect(app.get(DictionaryBootstrapService).run()).resolves.toBe('skipped');
  });

  it('reports 503 importing on the readiness probe while an automatic import runs, import_failed after a failure', async () => {
    process.env.DICTIONARY_AUTO_IMPORT = 'false';
    await boot();
    const status = app.get(ImportStatusService);
    status.begin(ImportTriggerE.auto, 'HuggingFace');
    status.progress({ percent: 37, stage: 0 });
    let res = await request(server()).get('/api/ready').expect(503);
    expect(res.body).toEqual({ status: 'error', reason: 'importing', percent: 37, stage: 0 });

    status.end({ error: 'HTTP 502' });
    res = await request(server()).get('/api/ready').expect(503);
    expect(res.body).toEqual({ status: 'error', reason: 'import_failed', error: 'HTTP 502' });

    // an admin import (here: begun and completed by hand) clears it
    status.begin(ImportTriggerE.manual, 'upload');
    status.end({ dataset_version: '1.0.0' });
    await request(server()).get('/api/ready').expect(200);
    process.env.DICTIONARY_AUTO_IMPORT = 'true';
  });

  it('refuses a second import while one holds the slot (409 import_in_progress)', async () => {
    process.env.DICTIONARY_AUTO_IMPORT = 'false';
    await boot();
    app.get(ImportStatusService).begin(ImportTriggerE.manual, 'upload');
    const res = await request(server()).post('/api/en/dictionary/import').set(auth).send({}).expect(409);
    expect(res.body.message).toBe('import_in_progress');
    process.env.DICTIONARY_AUTO_IMPORT = 'true';
  });
});
