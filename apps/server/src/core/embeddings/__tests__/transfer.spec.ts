import '../../../modules/EnModule/__tests__/helpers/clearDatabaseUrl';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Logger } from '@nestjs/common';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { DB_ENTITIES } from '../../../db/typeorm-options';
import { EnEntry } from '../../../modules/EnModule/entities/en_entry.entity';
import { EnWord } from '../../../modules/EnModule/entities/en_word.entity';
import { EnMeaning } from '../../../modules/EnModule/entities/en_meaning.entity';
import { EnMeaningEmbedding } from '../../../modules/EnModule/entities/en_meaning_embedding.entity';
import { EnEmbeddingProfile } from '../../../modules/EnModule/entities/en_embedding_profile.entity';
import { EnImportDictionaryService } from '../../../modules/EnModule/modules/EnImportDictionary/enImportDictionary.service';
import {
  DirectoryDatasetSource,
  openZipDatasetSource,
} from '../../../modules/EnModule/modules/EnImportDictionary/sources';
import { DATASET_FILE_NAMES } from '../../../modules/EnModule/modules/EnImportDictionary/constants';
import { SettingsService } from '../../../modules/SettingsModule/settings.service';
import { WordRowsService } from '../../../modules/EnModule/word-rows.service';
import { EnPartOfSpeechE, EnWordFormsE, ImportTriggerE } from '../../../../types';
import type { EmbeddingManifestT, MeaningEmbeddingLineT } from '../../../../types/embeddings';
import { embeddingInputHash, embeddingProfileId } from '../profile';
import {
  embeddingDocument,
  embeddingManifest,
  exportMeaningEmbeddings,
  importMeaningEmbeddings,
} from '../transfer';

const profile = {
  model: 'fixture-model',
  revision: 'a'.repeat(64),
  dimensions: 3,
  normalization: 'l2' as const,
  document_format: 'meaning-v1',
  query_format: 'search-query-v1',
};
const manifest: EmbeddingManifestT = { format: 1, profiles: [{ ...profile, id: embeddingProfileId(profile) }] };
const progress = { start() {}, write() {}, end() {} };

describe('portable embedding transfer without inference', () => {
  let source: DataSource;
  let target: DataSource;
  let dir: string;
  let file: string;
  const services: EnImportDictionaryService[] = [];
  const database = () =>
    new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: DB_ENTITIES,
      synchronize: true,
    }).initialize();
  beforeEach(async () => {
    source = await database();
    target = await database();
    dir = await mkdtemp(join(tmpdir(), 'vbh-embedding-transfer-'));
    file = join(dir, DATASET_FILE_NAMES.meaningEmbeddings);
  });
  afterEach(async () => {
    services.splice(0).forEach((s) => s.onModuleDestroy());
    await source.destroy();
    await target.destroy();
    await rm(dir, { recursive: true, force: true });
  });
  async function meaning(db: DataSource, spelling = 'ornithologist', sync_id = randomUUID()) {
    const word = await db.manager.save(EnWord, {
      word: await db.manager.save(EnEntry, { word: spelling }),
      part_of_speech: EnPartOfSpeechE.noun,
      form_of_word: EnWordFormsE.base_form,
      generated: false,
    });
    return db.manager.save(EnMeaning, {
      sync_id,
      word,
      title: 'bird scientist',
      definition: 'A scientist who studies birds.',
      sort_order: 1,
    });
  }
  function line(m: EnMeaning): MeaningEmbeddingLineT {
    return {
      meaning_sync_id: m.sync_id!,
      profile_id: manifest.profiles[0].id,
      input_hash: embeddingInputHash(embeddingDocument(m)),
      embedding: [1, 0, 0],
    };
  }
  async function write(lines: unknown[]) {
    await writeFile(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  }
  function service(db: DataSource) {
    const value = new EnImportDictionaryService(db.getRepository(EnWord), new WordRowsService(db), {
      upsert: async () => {},
    } as unknown as SettingsService);
    services.push(value);
    return value;
  }
  it('maps portable identities onto different row IDs and exports only current vectors', async () => {
    const m = await meaning(source);
    await meaning(target, 'unrelated');
    const copy = await meaning(target, 'ornithologist', m.sync_id!);
    expect(copy.id).not.toBe(m.id);
    await write([line(m)]);
    await importMeaningEmbeddings(target.manager, file, manifest, 1);
    expect((await target.manager.findOneByOrFail(EnMeaningEmbedding, {})).meaning_id).toBe(copy.id);
    const exported = join(dir, 'export.jsonl');
    expect(await exportMeaningEmbeddings(target.manager, exported)).toEqual({ manifest, count: 1 });
    expect(JSON.parse((await readFile(exported, 'utf8')).trim())).toEqual(line(m));
    await target.manager.update(EnMeaning, copy.id, { definition: 'Changed text' });
    expect(await exportMeaningEmbeddings(target.manager, join(dir, 'stale.jsonl'))).toBeNull();
  });
  it('rolls back earlier chunks and profile creation when the final line is damaged', async () => {
    const m = await meaning(target);
    const lines = [line(m)];
    for (let i = 0; i < 201; i++) {
      const next = await target.manager.save(EnMeaning, {
        ...m,
        id: undefined,
        sync_id: randomUUID(),
        sort_order: i + 2,
      });
      lines.push(line(next));
    }
    await write(lines);
    await writeFile(file, (await readFile(file, 'utf8')) + '{broken\n');
    await expect(importMeaningEmbeddings(target.manager, file, manifest, lines.length + 1)).rejects.toThrow(
      'embeddings_invalid',
    );
    expect(await target.manager.count(EnMeaningEmbedding)).toBe(0);
    expect(await target.manager.count(EnEmbeddingProfile)).toBe(0);
  });
  it.each(['unknown', 'stale', 'dimensions', 'norm', 'duplicate', 'profile', 'truncated', 'numeric_id'])(
    'rejects %s without replacing existing vectors',
    async (kind) => {
      const m = await meaning(target);
      const original = line(m);
      await write([original]);
      await importMeaningEmbeddings(target.manager, file, manifest, 1);
      const changed = { ...original, embedding: [0, 1, 0] };
      if (kind === 'unknown') changed.meaning_sync_id = randomUUID();
      if (kind === 'stale') changed.input_hash = 'b'.repeat(64);
      if (kind === 'dimensions') changed.embedding = [1, 0];
      if (kind === 'norm') changed.embedding = [1, 1, 1];
      if (kind === 'profile') changed.profile_id = 'b'.repeat(64);
      await write(
        kind === 'duplicate'
          ? [changed, changed]
          : kind === 'numeric_id'
            ? [{ ...changed, meaning_id: m.id }]
            : [changed],
      );
      await expect(
        importMeaningEmbeddings(target.manager, file, manifest, kind === 'truncated' ? 2 : 1),
      ).rejects.toThrow();
      expect((await target.manager.findOneByOrFail(EnMeaningEmbedding, {})).embedding).toEqual([1, 0, 0]);
    },
  );
  it('rejects mutable model identity, unknown preprocessing and forged profile IDs', () => {
    for (const override of [{ revision: 'latest' }, { document_format: 'unknown' }, { dimensions: 4 }])
      expect(() =>
        embeddingManifest({ ...manifest, profiles: [{ ...manifest.profiles[0], ...override }] }),
      ).toThrow();
  });
  it('imports a vectors-only directory without changing dictionary versions or generating a review', async () => {
    const m = await meaning(target);
    await write([line(m)]);
    await writeFile(
      join(dir, 'manifest.json'),
      JSON.stringify({
        version: 'ignored-vector-version',
        source: 'vocab-bloom-hub',
        embeddings: manifest,
        files: { [DATASET_FILE_NAMES.meaningEmbeddings]: { lines: 1 } },
      }),
    );
    const imported = await DirectoryDatasetSource.open(dir, new Logger());
    await service(target).importFrom(imported, 'vectors', progress, ImportTriggerE.manual);
    expect(await target.manager.count(EnMeaningEmbedding)).toBe(1);
    expect(await target.manager.count(EnWord)).toBe(1);
  });
  it.each([false, true])('round-trips a real export archive (vectors only: %s)', async (embeddingsOnly) => {
    const m = await meaning(source);
    await write([line(m)]);
    await importMeaningEmbeddings(source.manager, file, manifest, 1);
    const chunks: string[] = [];
    await service(source).exportDictionary(
      {
        setHeader() {},
        write: (s: string) => {
          chunks.push(s);
        },
        end() {},
      } as unknown as Response,
      { embeddingsOnly },
    );
    const id = JSON.parse(chunks.at(-1)!).exportId;
    if (embeddingsOnly) await meaning(target, 'ornithologist', m.sync_id!);
    const archive = await openZipDatasetSource(join(tmpdir(), 'vocab-bloom-export', `${id}.zip`), new Logger());
    expect((await archive.readManifest())?.embeddings).toEqual(manifest);
    await service(target).importFrom(archive, 'roundtrip', progress, ImportTriggerE.manual);
    expect(await target.manager.count(EnMeaningEmbedding)).toBe(1);
    expect(await target.manager.count(EnWord)).toBe(1);
    expect((await target.manager.findOneByOrFail(EnMeaning, {})).sync_id).toBe(m.sync_id);
  });
  it('rolls back dictionary content too when its attached vectors are invalid', async () => {
    const m = await meaning(source);
    await write([{ ...line(m), input_hash: 'b'.repeat(64) }]);
    await writeFile(
      join(dir, DATASET_FILE_NAMES.words),
      JSON.stringify({
        word: 'ornithologist',
        part_of_speech: 'noun',
        forms: [],
        meanings: [{ sync_id: m.sync_id, title: m.title, definition: m.definition, sort_order: 1 }],
      }) + '\n',
    );
    await writeFile(
      join(dir, 'manifest.json'),
      JSON.stringify({
        version: '1',
        source: 'vocab-bloom-hub',
        embeddings: manifest,
        files: {
          [DATASET_FILE_NAMES.words]: { lines: 1 },
          [DATASET_FILE_NAMES.meaningEmbeddings]: { lines: 1 },
        },
      }),
    );
    const incoming = await DirectoryDatasetSource.open(dir, new Logger());
    await expect(
      service(target).importFrom(incoming, 'invalid native', progress, ImportTriggerE.manual),
    ).rejects.toThrow('embeddings_content_mismatch');
    expect(await target.manager.count(EnWord)).toBe(0);
    expect(await target.manager.count(EnMeaningEmbedding)).toBe(0);
  });
  it('rejects missing/truncated vector files at the directory boundary', async () => {
    await write([]);
    await writeFile(
      join(dir, 'manifest.json'),
      JSON.stringify({
        version: '',
        source: 'vocab-bloom-hub',
        embeddings: manifest,
        files: { [DATASET_FILE_NAMES.meaningEmbeddings]: { lines: 1 } },
      }),
    );
    await expect(DirectoryDatasetSource.open(dir, new Logger())).rejects.toThrow('dataset_invalid');
  });
});
