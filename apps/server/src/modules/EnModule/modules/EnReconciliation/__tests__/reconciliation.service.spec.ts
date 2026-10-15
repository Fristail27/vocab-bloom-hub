import { randomUUID } from 'node:crypto';
import { EnMeaning } from '../../../entities/en_meaning.entity';
import { EnMeaningTranslation } from '../../../entities/en_meaning_translation.entity';
import { ReconciliationStore } from '../store';
import { object } from '../document';
import { withChangeSource } from '../../../utils/changes/context';
import { recordChange } from '../../../utils/changes/recordChange';
import {
  ChangeActionE,
  ChangeEntityE,
  ChangeOriginE,
  AvailableTranslationLanguagesE,
} from '../../../../../../types';
import { DataSource } from 'typeorm';
import { DB_ENTITIES } from '../../../../../db/typeorm-options';
import { Dataset } from '../../../../DatasetsModule/entities/dataset.entity';
import { DatasetsService } from '../../../../DatasetsModule/datasets.service';
import { SwitchGate } from '../../../../DatasetsModule/switch-gate';
import { ImportStatusService } from '../../EnImportDictionary/importStatus.service';
import { ReconciliationService } from '../reconciliation.service';
import { EnEntry } from '../../../entities/en_entry.entity';
import { EnWord } from '../../../entities/en_word.entity';
import { EnChange } from '../../../entities/en_change.entity';
import { EnPartOfSpeechE, EnWordFormsE } from '../../../../../../types';
import { ReconciliationPlan } from '../entities';

describe('reconciliation publishes dictionary changes', () => {
  let db: DataSource;
  let source: DataSource;
  let service: ReconciliationService;
  let imports: ImportStatusService;
  let dataset: Dataset;
  beforeEach(async () => {
    db = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: DB_ENTITIES,
      synchronize: true,
    }).initialize();
    source = await new DataSource({
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
    imports = new ImportStatusService();
    const datasets = {
      find: async () => db.manager.findOneByOrFail(Dataset, { id: dataset.id }),
      reader: async () => db,
      gate: new SwitchGate(),
      supported: false,
      reconciliationCommitted: jest.fn(),
      getActive: () => dataset,
    } as unknown as DatasetsService;
    service = new ReconciliationService(datasets, imports);
  });
  afterEach(async () => {
    await db.destroy();
    await source.destroy();
  });

  async function word(connection: DataSource, spelling: string, description: string) {
    const entry = await connection.manager.save(EnEntry, { word: spelling });
    return connection.manager.save(EnWord, {
      word: entry,
      part_of_speech: EnPartOfSpeechE.noun,
      form_of_word: EnWordFormsE.base_form,
      generated: false,
      description,
    });
  }

  it('previews without changing live data, applies additions/deletions/edits and records the operation', async () => {
    const original = await word(db, 'kept', 'before');
    await word(db, 'deleted', 'gone');
    await service.rememberSource('default');
    await word(source, 'kept', 'after');
    await word(source, 'added', 'new');
    const plan = await service.prepareSource('default', source.manager, '2', true);
    expect(plan.counts).toMatchObject({ added: 1, deleted: 1, changed: 1, conflicts: 0 });
    expect((await db.manager.findOneByOrFail(EnWord, { id: original.id })).description).toBe('before');
    expect(await db.manager.count(EnChange)).toBe(0);
    expect((await service.apply('default', plan.id)).status).toBe('applied');
    expect((await db.manager.findOneByOrFail(EnWord, { id: original.id })).description).toBe('after');
    expect(await db.manager.existsBy(EnEntry, { word: 'deleted' })).toBe(false);
    expect(await db.manager.existsBy(EnEntry, { word: 'added' })).toBe(true);
    const changes = await db.manager.find(EnChange);
    expect(changes.length).toBeGreaterThanOrEqual(3);
    expect(changes.every((change) => change.operation?.id === plan.id && change.contribution === null)).toBe(
      true,
    );
    const count = changes.length;
    await service.apply('default', plan.id);
    expect(await db.manager.count(EnChange)).toBe(count);
    expect(imports.running).toBe(false);
  });

  it('rejects a stale preview and releases the operation slot', async () => {
    const original = await word(db, 'word', 'before');
    await service.rememberSource('default');
    await word(source, 'word', 'incoming');
    const plan = await service.prepareSource('default', source.manager, '2', true);
    await db.manager.update(EnWord, { id: original.id }, { description: 'later local edit' });
    await expect(service.apply('default', plan.id)).rejects.toThrow('stale');
    expect(imports.running).toBe(false);
    expect((await db.manager.findOneByOrFail(ReconciliationPlan, { id: plan.id })).status).toBe('review');
    expect((await db.manager.findOneByOrFail(EnWord, { id: original.id })).description).toBe(
      'later local edit',
    );
  });
  it('retains a keep-local resolution without inventing an edit and does not replay it', async () => {
    const original = await word(db, 'word', 'base');
    await service.rememberSource('default');
    await db.manager.update(EnWord, original.id, { description: 'local' });
    await word(source, 'word', 'incoming');
    const plan = await service.prepareSource('default', source.manager, '1', true);
    const item = (await service.items('default', plan.id, 1)).items[0];
    expect(item.comparison.conflicts.map((row) => row.path)).toEqual([
      ['parts', 'noun', 'common', 'description'],
    ]);
    await service.decide(
      'default',
      plan.id,
      'word',
      item.version,
      item.comparison.conflicts.map((row) => ({ path: row.path, choice: 'local' })),
    );
    expect((await service.apply('default', plan.id)).proposed).toEqual({ added: 0, deleted: 0, changed: 0 });
    expect(await db.manager.count(EnChange)).toBe(0);
    expect((await service.list('default', 'word')).plans).toHaveLength(1);
    const repeated = await service.prepareSource('default', source.manager, '1', true);
    expect(repeated.remaining_conflicts).toBe(0);
    expect(repeated.proposed.changed).toBe(0);
  });

  it('combines independent edits of a meaning and its translation using portable identities', async () => {
    const local = await word(db, 'word', 'base');
    const incoming = await word(source, 'word', 'base');
    const meaningId = randomUUID();
    const translationId = randomUUID();
    const language = Object.values(AvailableTranslationLanguagesE)[0];
    for (const [connection, parent] of [
      [db, local],
      [source, incoming],
    ] as const) {
      const meaning = await connection.manager.save(EnMeaning, {
        word: parent,
        sync_id: meaningId,
        title: 'sense',
        definition: 'base',
        sort_order: 1,
      });
      await connection.manager.save(EnMeaningTranslation, {
        meaning,
        sync_id: translationId,
        language,
        title: 'translation',
        definition: 'base',
        variants_of_words: [],
      });
    }
    await service.rememberSource('default');
    await db.manager.update(
      EnMeaningTranslation,
      { sync_id: translationId },
      { definition: 'local translation' },
    );
    await source.manager.update(EnMeaning, { sync_id: meaningId }, { definition: 'incoming definition' });
    const plan = await service.prepareSource('default', source.manager, '1', true);
    expect(plan.remaining_conflicts).toBe(0);
    await service.apply('default', plan.id);
    expect((await db.manager.findOneByOrFail(EnMeaning, { sync_id: meaningId })).definition).toBe(
      'incoming definition',
    );
    expect(
      (await db.manager.findOneByOrFail(EnMeaningTranslation, { sync_id: translationId })).definition,
    ).toBe('local translation');
    const changes = await db.manager.find(EnChange);
    expect(
      changes.some(
        (row) => row.entity === ChangeEntityE.meaning && row.diff.definition?.after === 'incoming definition',
      ),
    ).toBe(true);
    expect(changes.some((row) => row.entity === ChangeEntityE.meaning_translation)).toBe(false);
  });

  it('makes delete/reference consequences reviewable and rejects a dangling result', async () => {
    const first = await word(db, 'first', 'base');
    await word(db, 'second', 'base');
    const incoming = await word(source, 'first', 'base');
    const identity = randomUUID();
    await db.manager.save(EnMeaning, {
      word: first,
      sync_id: identity,
      title: 'sense',
      definition: 'base',
      sort_order: 1,
      synonyms: [{ word: 'second' }],
    });
    await source.manager.save(EnMeaning, {
      word: incoming,
      sync_id: identity,
      title: 'sense',
      definition: 'base',
      sort_order: 1,
    });
    await service.rememberSource('default');
    // The relationship is a local addition, absent from the ancestor and upstream.
    const baseline = await db.manager.findOneByOrFail(EnMeaning, { sync_id: identity });
    await db.manager.update(EnMeaning, baseline.id, { definition: 'local edit' });
    // Incoming removes second while local retains a reference through a local-only sense.
    const extra = randomUUID();
    await db.manager.save(EnMeaning, {
      word: first,
      sync_id: extra,
      title: 'local sense',
      definition: 'local',
      sort_order: 2,
      synonyms: [{ word: 'second' }],
    });
    const plan = await service.prepareSource('default', source.manager, '1', true);
    expect(plan.counts.conflicts).toBe(2);
    await expect(service.apply('default', plan.id)).rejects.toThrow('unresolved');
    const list = await service.items('default', plan.id, 1);
    for (const item of list.items)
      await service.override('default', plan.id, item.headword, item.version, item.local);
    await service.apply('default', plan.id);
    expect(await db.manager.existsBy(EnEntry, { word: 'second' })).toBe(true);
  });

  it('keeps a partial update from removing absent meanings or words', async () => {
    const local = await word(db, 'word', 'base');
    await word(db, 'outside', 'base');
    const incoming = await word(source, 'word', 'base');
    const first = randomUUID();
    await db.manager.save(EnMeaning, {
      word: local,
      sync_id: first,
      title: 'kept',
      definition: 'base',
      sort_order: 1,
    });
    await db.manager.save(EnMeaning, {
      word: local,
      sync_id: randomUUID(),
      title: 'not supplied',
      definition: 'base',
      sort_order: 2,
    });
    await source.manager.save(EnMeaning, {
      word: incoming,
      sync_id: first,
      title: 'kept',
      definition: 'incoming',
      sort_order: 1,
    });
    await service.rememberSource('default');
    const plan = await service.prepareSource('default', source.manager, '1', false);
    expect(plan.proposed.deleted).toBe(0);
    await service.apply('default', plan.id);
    expect(await db.manager.count(EnMeaning)).toBe(2);
    expect(await db.manager.existsBy(EnEntry, { word: 'outside' })).toBe(true);
  });

  it('preserves history of a deleted incoming word, including original authorship', async () => {
    await word(db, 'deleted', 'base');
    await service.rememberSource('default');
    await source.transaction((em) =>
      withChangeSource({ origin: ChangeOriginE.admin, author: 'original author', contribution: null }, () =>
        recordChange(em, {
          headword: 'deleted',
          part_of_speech: EnPartOfSpeechE.noun,
          entity: ChangeEntityE.word,
          action: ChangeActionE.delete,
          diff: { description: { before: 'base', after: null } },
        }),
      ),
    );
    const plan = await service.prepareSource('default', source.manager, '1', true);
    await service.apply('default', plan.id);
    expect(await db.manager.existsBy(EnEntry, { word: 'deleted' })).toBe(false);
    expect(
      (await db.manager.find(EnChange)).some((row) => row.author === 'original author' && row.inherited_from),
    ).toBe(true);
    const rows = await new ReconciliationStore(db.manager).list(plan.id);
    expect(rows.items[0].incoming.present).toBe(false);
  });

  it('rejects provenance changes in a hand-edited result and rolls back the decision', async () => {
    await word(db, 'word', 'base');
    await word(source, 'word', 'incoming');
    await service.rememberSource('default');
    const plan = await service.prepareSource('default', source.manager, '1', true);
    const item = (await service.items('default', plan.id, 1)).items[0];
    if (!item.result.present) throw new Error('expected a result');
    const result = structuredClone(item.result);
    if (!result.present) throw new Error('expected a result');
    const common = object(object(object(result.value).parts).noun);
    object(common.common).origins = [];
    await expect(service.override('default', plan.id, 'word', item.version, result)).rejects.toThrow(
      'origins_immutable',
    );
    expect((await service.items('default', plan.id, 1)).items[0].version).toBe(item.version);
  });
});
