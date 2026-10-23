import { randomUUID } from 'node:crypto';
import { embeddingInputHash, embeddingProfileId } from '../../../../../core/embeddings/profile';
import { EnMeaning } from '../../../entities/en_meaning.entity';
import { EnMeaningEmbedding } from '../../../entities/en_meaning_embedding.entity';
import { ReconciliationEmbedding } from '../entities';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { DB_ENTITIES } from '../../../../../db/typeorm-options';
import { Dataset } from '../../../../DatasetsModule/entities/dataset.entity';
import { DatasetsService } from '../../../../DatasetsModule/datasets.service';
import { SwitchGate } from '../../../../DatasetsModule/switch-gate';
import { SettingsService } from '../../../../SettingsModule/settings.service';
import { ImportStatusService } from '../../EnImportDictionary/importStatus.service';
import { EnImportDictionaryService } from '../../EnImportDictionary/enImportDictionary.service';
import { DATASET_FILE_NAMES } from '../../EnImportDictionary/constants';
import { ReconciliationService } from '../reconciliation.service';
import { EnEntry } from '../../../entities/en_entry.entity';
import { EnWord } from '../../../entities/en_word.entity';
import { EnChange } from '../../../entities/en_change.entity';
import { WordRowsService } from '../../../word-rows.service';
import { EnPartOfSpeechE, EnWordFormsE, ImportTriggerE, ImportDictionaryChunkT } from '../../../../../../types';
import { DatasetSource } from '../../EnImportDictionary/sources/types';
import { ReconciliationPlan } from '../entities';

/** Exercises the real importer and its temporary database, without the developer's database. */
describe('source file reconciliation pipeline', () => {
  let db: DataSource;
  let dir: string;
  let dataset: Dataset;
  let importer: EnImportDictionaryService;
  let service: ReconciliationService;
  let status: ImportStatusService;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'vbh-source-review-'));
    db = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: DB_ENTITIES,
      synchronize: true,
    }).initialize();
    dataset = await db.manager.save(Dataset, {
      name: 'default',
      schema: 'public',
      source: 'vocab-bloom-hub',
      own: true,
      language: 'en',
      title: 'Test',
      license: 'CC0-1.0',
      license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attribution: 'Test',
      version: '1',
    });
    const datasets = {
      find: async () => db.manager.findOneByOrFail(Dataset, { id: dataset.id }),
      reader: async () => db,
      resolveTarget: async () => dataset,
      connect: async () => ({ manager: db.manager, dataset, close: async () => {} }),
      gate: new SwitchGate(),
      supported: false,
      getActive: () => dataset,
      reconciliationCommitted: jest.fn(),
    } as unknown as DatasetsService;
    status = new ImportStatusService();
    service = new ReconciliationService(datasets, status);
    importer = new EnImportDictionaryService(
      db.getRepository(EnWord),
      new WordRowsService(db),
      {} as SettingsService,
      undefined,
      status,
      datasets,
      service,
    );
    await db.manager.save(EnWord, {
      word: await db.manager.save(EnEntry, { word: 'word' }),
      part_of_speech: EnPartOfSpeechE.noun,
      form_of_word: EnWordFormsE.base_form,
      generated: false,
      description: 'original',
    });
    await service.rememberSource('default');
  });
  afterEach(async () => {
    importer.onModuleDestroy();
    await db.destroy();
    await rm(dir, { recursive: true, force: true });
  });

  async function source(expected = 1): Promise<DatasetSource> {
    const file = join(dir, 'words.jsonl');
    await writeFile(
      file,
      `${JSON.stringify({ word: 'word', part_of_speech: 'noun', description: 'incoming', forms: [], is_obsolete: false })}\n`,
    );
    return {
      readManifest: async () => ({
        version: '2',
        source: dataset.source,
        license: dataset.license,
        files: { [DATASET_FILE_NAMES.words]: { lines: expected } },
        snapshot: { complete: true, adapter: 'native', revision: 1, skipped: 0 },
      }),
      acquireFile: async (name) => ({ path: name === DATASET_FILE_NAMES.words ? file : '', temporary: false }),
      dispose: async () => {},
    };
  }

  it('turns an ordinary archive import into a review and only changes content/history/version on apply', async () => {
    const chunks: ImportDictionaryChunkT[] = [];
    await importer.importFrom(
      await source(),
      'fixture',
      {
        start() {},
        write: (chunk) => {
          chunks.push(chunk);
        },
        end() {},
      },
      ImportTriggerE.manual,
      { dataset: 'default' },
    );
    const id = chunks[chunks.length - 1].reconciliation_plan!;
    expect(id).toBeTruthy();
    expect(status.running).toBe(false);
    expect((await db.manager.findOneByOrFail(EnWord, { id: 1 })).description).toBe('original');
    expect((await db.manager.findOneByOrFail(Dataset, { id: dataset.id })).version).toBe('1');
    expect(await db.manager.count(EnChange)).toBe(0);
    await service.apply('default', id);
    expect((await db.manager.findOneByOrFail(EnWord, { id: 1 })).description).toBe('incoming');
    expect((await db.manager.findOneByOrFail(Dataset, { id: dataset.id })).version).toBe('2');
    expect((await db.manager.find(EnChange)).some((row) => row.operation?.id === id)).toBe(true);
  });

  it('rejects a truncated declared snapshot without publishing a plan or touching live content', async () => {
    await expect(
      importer.importFrom(
        await source(2),
        'fixture',
        { start() {}, write() {}, end() {} },
        ImportTriggerE.manual,
        { dataset: 'default' },
      ),
    ).rejects.toThrow('input_incomplete');
    expect(status.running).toBe(false);
    expect(await db.manager.count(ReconciliationPlan)).toBe(0);
    expect((await db.manager.findOneByOrFail(EnWord, { id: 1 })).description).toBe('original');
    expect(await db.manager.count(EnChange)).toBe(0);
  });
  it('keeps vectors with a durable plan and publishes them only with accepted content', async () => {
    const input = await source();
    const sync_id = randomUUID();
    await writeFile(
      join(dir, 'words.jsonl'),
      JSON.stringify({
        word: 'word',
        part_of_speech: 'noun',
        description: 'incoming',
        forms: [],
        is_obsolete: false,
        meanings: [{ sync_id, title: 'sense', definition: 'Incoming definition', sort_order: 1 }],
      }) + '\n',
    );
    const profile = {
      model: 'fixture',
      revision: 'a'.repeat(64),
      dimensions: 3,
      normalization: 'l2' as const,
      document_format: 'meaning-v1',
      query_format: 'search-query-v1',
    };
    const vectors = join(dir, 'vectors.jsonl');
    await writeFile(
      vectors,
      JSON.stringify({
        meaning_sync_id: sync_id,
        profile_id: embeddingProfileId(profile),
        input_hash: embeddingInputHash('title: word (noun) | text: sense. Incoming definition'),
        embedding: [1, 0, 0],
      }) + '\n',
    );
    const enriched: DatasetSource = {
      ...input,
      readManifest: async () => ({
        ...(await input.readManifest())!,
        embeddings: { format: 1, profiles: [{ ...profile, id: embeddingProfileId(profile) }] },
        files: {
          [DATASET_FILE_NAMES.words]: { lines: 1 },
          [DATASET_FILE_NAMES.meaningEmbeddings]: { lines: 1 },
        },
      }),
      acquireFile: async (name, sink) =>
        name === DATASET_FILE_NAMES.meaningEmbeddings
          ? { path: vectors, temporary: false }
          : input.acquireFile(name, sink),
    };
    const chunks: ImportDictionaryChunkT[] = [];
    await importer.importFrom(
      enriched,
      'vectors with content',
      {
        start() {},
        write: (c) => {
          chunks.push(c);
        },
        end() {},
      },
      ImportTriggerE.manual,
    );
    const id = chunks.at(-1)!.reconciliation_plan!;
    expect(await db.manager.count(EnMeaningEmbedding)).toBe(0);
    expect(await db.manager.count(ReconciliationEmbedding)).toBe(1);
    await rm(vectors); // The upload and staging database are no longer needed.
    await service.apply('default', id);
    const meaning = await db.manager.findOneByOrFail(EnMeaning, { sync_id });
    expect((await db.manager.findOneByOrFail(EnMeaningEmbedding, {})).meaning_id).toBe(meaning.id);
    expect(await db.manager.count(ReconciliationEmbedding)).toBe(0);
    await service.apply('default', id);
    expect(await db.manager.count(EnMeaningEmbedding)).toBe(1);
  });

  it('imports vector-only input directly without a review or a dictionary version change', async () => {
    const word = await db.manager.findOneByOrFail(EnWord, { id: 1 });
    const meaning = await db.manager.save(EnMeaning, {
      word,
      sync_id: randomUUID(),
      title: 'sense',
      definition: 'Definition',
      sort_order: 1,
    });
    const profile = {
      model: 'fixture',
      revision: 'a'.repeat(64),
      dimensions: 3,
      normalization: 'l2' as const,
      document_format: 'meaning-v1',
      query_format: 'search-query-v1',
    };
    const vectors = join(dir, 'only-vectors.jsonl');
    await writeFile(
      vectors,
      JSON.stringify({
        meaning_sync_id: meaning.sync_id,
        profile_id: embeddingProfileId(profile),
        input_hash: embeddingInputHash('title: word (noun) | text: sense. Definition'),
        embedding: [1, 0, 0],
      }) + '\n',
    );
    const input: DatasetSource = {
      readManifest: async () => ({
        version: 'must-not-be-used',
        source: dataset.source,
        embeddings: { format: 1, profiles: [{ ...profile, id: embeddingProfileId(profile) }] },
        files: { [DATASET_FILE_NAMES.meaningEmbeddings]: { lines: 1 } },
      }),
      acquireFile: async () => ({ path: vectors, temporary: false }),
      dispose: async () => {},
    };
    await importer.importFrom(
      input,
      'only vectors',
      { start() {}, write() {}, end() {} },
      ImportTriggerE.manual,
    );
    expect(await db.manager.count(ReconciliationPlan)).toBe(0);
    expect(await db.manager.count(EnChange)).toBe(0);
    expect(await db.manager.count(EnMeaningEmbedding)).toBe(1);
    expect((await db.manager.findOneByOrFail(Dataset, { id: dataset.id })).version).toBe('1');
  });

  it('does not treat a locally emptied dataset as a first installation', async () => {
    await db.manager.delete(EnEntry, { word: 'word' });
    const chunks: ImportDictionaryChunkT[] = [];
    await importer.importFrom(
      await source(),
      'fixture',
      {
        start() {},
        write: (chunk) => {
          chunks.push(chunk);
        },
        end() {},
      },
      ImportTriggerE.manual,
      { dataset: 'default' },
    );
    expect(chunks.at(-1)?.reconciliation_plan).toBeTruthy();
    expect(await db.manager.count(EnEntry)).toBe(0);
    const plan = await service.summary('default', chunks.at(-1)!.reconciliation_plan!);
    expect(plan.remaining_conflicts).toBeGreaterThan(0);
  });
});
