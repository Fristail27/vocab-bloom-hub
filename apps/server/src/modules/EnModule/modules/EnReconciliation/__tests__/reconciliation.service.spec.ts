import { randomUUID } from 'node:crypto';
import { datasetOrigin } from '../../../../../../core/utils/provenance';
import { EnMeaning } from '../../../entities/en_meaning.entity';
import { EnMeaningTranslation } from '../../../entities/en_meaning_translation.entity';
import { ReconciliationStore } from '../store';
import { object } from '../document';
import { withChangeSource } from '../../../utils/changes/context';
import { recordChange } from '../../../utils/changes/recordChange';
import { revertChange } from '../../../utils/changes/revertChange';
import {
  ChangeActionE,
  ChangeEntityE,
  ChangeOriginE,
  AvailableTranslationLanguagesE,
} from '../../../../../../types';
import { DataSource, EntityManager } from 'typeorm';
import { DB_ENTITIES } from '../../../../../db/typeorm-options';
import { Dataset } from '../../../../DatasetsModule/entities/dataset.entity';
import { DatasetsService } from '../../../../DatasetsModule/datasets.service';
import { AuditLog } from '../../../../AuditModule/entities/audit_log.entity';
import { SwitchGate } from '../../../../DatasetsModule/switch-gate';
import { ImportStatusService } from '../../EnImportDictionary/importStatus.service';
import { ReconciliationService } from '../reconciliation.service';
import { EnEntry } from '../../../entities/en_entry.entity';
import { EnWord } from '../../../entities/en_word.entity';
import { EnChange } from '../../../entities/en_change.entity';
import { EnPartOfSpeechE, EnWordFormsE } from '../../../../../../types';
import { ReconciliationPlan, ReconciliationRevision, ReconciliationIdentity } from '../entities';
import { dictionaryRecords, datasetSnapshotMetadata, persistentLineage } from '../snapshot';

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
    const added = await word(source, 'added', 'new');
    await source.manager.update(EnWord, added.id, { version: '2.0.0' });
    const plan = await service.prepareSource('default', source.manager, '2', true);
    expect(plan.counts).toMatchObject({ added: 1, deleted: 1, changed: 1, conflicts: 0 });
    expect((await db.manager.findOneByOrFail(EnWord, { id: original.id })).description).toBe('before');
    expect(await db.manager.count(EnChange)).toBe(0);
    expect((await service.apply('default', plan.id)).status).toBe('applied');
    expect((await db.manager.findOneByOrFail(EnWord, { id: original.id })).description).toBe('after');
    expect(await db.manager.existsBy(EnEntry, { word: 'deleted' })).toBe(false);
    expect(await db.manager.existsBy(EnEntry, { word: 'added' })).toBe(true);
    expect((await db.manager.findOneByOrFail(EnEntry, { word: 'added' })).user_modified).toBe(false);
    expect(
      (await db.manager.findOneByOrFail(AuditLog, { request_id: `reconciliation:${plan.id}` })).headword,
    ).toBe('default');
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
  it('a complete update after a partial one still deletes an omitted nested meaning', async () => {
    const local = await word(db, 'word', 'base');
    const incoming = await word(source, 'word', 'base');
    const kept = randomUUID();
    const removed = randomUUID();
    for (const [connection, parent] of [
      [db, local],
      [source, incoming],
    ] as const) {
      await connection.manager.save(EnMeaning, {
        word: parent,
        sync_id: kept,
        title: 'kept',
        definition: 'kept',
        sort_order: 1,
      });
    }
    await db.manager.save(EnMeaning, {
      word: local,
      sync_id: removed,
      title: 'removed later',
      definition: 'old',
      sort_order: 2,
    });
    await service.rememberSource('default');
    const partial = await service.prepareSource('default', source.manager, '1', false);
    await service.apply('default', partial.id);
    expect(await db.manager.count(EnMeaning)).toBe(2);
    const complete = await service.prepareSource('default', source.manager, '1', true);
    await service.apply('default', complete.id);
    expect(await db.manager.count(EnMeaning)).toBe(1);
  });

  it.each(['CC0-1.0', 'CC-BY-SA-4.0'])(
    'rechecks %s terms when accepting a previously declined edit',
    async (license) => {
      const local = await word(db, 'word', 'base');
      await service.rememberSource('default');
      await db.manager.update(EnWord, local.id, { description: 'local' });
      await word(source, 'word', 'incoming');
      await source.transaction((em) =>
        withChangeSource(
          {
            origin: ChangeOriginE.admin,
            author: 'upstream author',
            contribution: datasetOrigin({ ...dataset, license }),
          },
          () =>
            recordChange(em, {
              headword: 'word',
              part_of_speech: EnPartOfSpeechE.noun,
              entity: ChangeEntityE.word,
              action: ChangeActionE.update,
              diff: { description: { before: 'base', after: 'incoming' } },
            }),
        ),
      );
      const first = await service.prepareSource('default', source.manager, '1', true);
      const item = (await service.items('default', first.id, 1)).items[0];
      await service.decide(
        'default',
        first.id,
        'word',
        item.version,
        item.comparison.conflicts.map((conflict) => ({ path: conflict.path, choice: 'local' })),
      );
      await service.apply('default', first.id);
      const inherited = await db.manager.findOneByOrFail(EnChange, { author: 'upstream author' });
      expect(inherited.superseded_at).not.toBeNull();
      await db.manager.update(EnChange, inherited.id, { author: null });
      const second = await service.prepareSource('default', source.manager, '1', true);
      const next = (await service.items('default', second.id, 1)).items[0];
      await service.override('default', second.id, 'word', next.version, next.incoming);
      if (license !== dataset.license) {
        await expect(service.apply('default', second.id)).rejects.toThrow('provenance_license_conflict');
        expect((await db.manager.findOneByOrFail(EnWord, { id: local.id })).description).toBe('local');
        expect((await db.manager.findOneByOrFail(EnChange, { id: inherited.id })).superseded_at).not.toBeNull();
        expect((await service.summary('default', second.id)).status).toBe('review');
        return;
      }
      await service.apply('default', second.id);
      expect((await db.manager.findOneByOrFail(EnWord, { id: local.id })).description).toBe('incoming');
      expect(await db.manager.findOneByOrFail(EnChange, { id: inherited.id })).toMatchObject({
        superseded_at: null,
        author: null,
        contribution: expect.objectContaining({ licenses: [expect.objectContaining({ spdx: license })] }),
      });
      expect(await db.manager.countBy(EnChange, { author: 'upstream author' })).toBe(0);
    },
  );

  it('a sibling merge must not choose an older shared revision and undo a local revert', async () => {
    const local = await word(db, 'word', 'old');
    await word(source, 'word', 'new');
    const sourceDataset = await source.manager.save(Dataset, {
      name: 'sibling',
      schema: 'ds_sibling',
      source: dataset.source,
      own: true,
      language: 'en',
      title: dataset.title,
      license: dataset.license,
      license_url: dataset.license_url,
      attribution: dataset.attribution,
      version: dataset.version,
    });
    const captureCommon = async (id: string, parents: string[] = []) =>
      db.transaction(async (em) => {
        const captured = await new ReconciliationStore(em).capture(
          'shared-parent',
          datasetSnapshotMetadata(dataset),
          true,
          dictionaryRecords(em, dataset),
          parents,
        );
        await em
          .createQueryBuilder()
          .update('reconciliation_records')
          .set({ revision: id })
          .where('revision = :revision', { revision: captured.id })
          .execute();
        await em.update(ReconciliationRevision, { id: captured.id }, { id });
        const revision = await em.findOneByOrFail(ReconciliationRevision, { id });
        await source.manager.insert(ReconciliationRevision, revision);
        for await (const row of new ReconciliationStore(em).records(id))
          await source.manager
            .createQueryBuilder()
            .insert()
            .into('reconciliation_records')
            .values(row)
            .execute();
      });
    await captureCommon('00000000-0000-4000-8000-000000000000');
    await db.manager.update(EnWord, local.id, { description: 'new' });
    await captureCommon('ffffffff-ffff-4fff-8fff-ffffffffffff', ['00000000-0000-4000-8000-000000000000']);
    for (const [connection, target] of [
      [db, dataset],
      [source, sourceDataset],
    ] as const) {
      await persistentLineage(connection.manager, target);
      await connection.manager.update(
        ReconciliationIdentity,
        { key: 'self' },
        { heads: ['ffffffff-ffff-4fff-8fff-ffffffffffff'] },
      );
    }
    // The datasets split at "new"; only the destination has since reverted to "old".
    await db.manager.update(EnWord, local.id, { description: 'old' });
    const datasets = {
      find: async (name: string) => (name === 'sibling' ? sourceDataset : dataset),
      reader: async (target: Dataset) =>
        target.name === 'sibling'
          ? {
              transaction: (_isolation: string, run: (em: EntityManager) => Promise<unknown>) =>
                source.transaction(run),
            }
          : db,
      gate: new SwitchGate(),
      supported: true,
      getActive: () => dataset,
      reconciliationCommitted: jest.fn(),
    } as unknown as DatasetsService;
    const merging = new ReconciliationService(datasets, imports);
    const plan = await merging.prepareParent('default', 'sibling');
    const item = (await merging.items('default', plan.id, 1)).items[0];
    expect(item.remaining).toBe(0);
    if (!item.result.present) throw new Error('expected content');
    expect(object(object(object(item.result.value).parts).noun).common).toMatchObject({ description: 'old' });
  });

  it('records custom fields in newly imported meanings and translations separately, with reversible incoming values', async () => {
    await service.rememberSource('default');
    const incoming = await word(source, 'new-word', 'upstream description');
    const meaning = await source.manager.save(EnMeaning, {
      word: incoming,
      sync_id: randomUUID(),
      title: 'sense',
      definition: 'upstream definition',
      sort_order: 1,
    });
    const translation = await source.manager.save(EnMeaningTranslation, {
      meaning,
      sync_id: randomUUID(),
      language: AvailableTranslationLanguagesE.ru,
      title: 'перевод',
      definition: 'upstream translation',
      variants_of_words: [],
    });
    const plan = await service.prepareSource('default', source.manager, '2', true);
    const item = (await service.items('default', plan.id, 1)).items[0];
    const result = structuredClone(item.incoming);
    if (!result.present) throw new Error('expected incoming word');
    const changed = object(object(object(object(result.value).parts).noun).meanings)[meaning.sync_id!];
    object(changed).definition = 'custom definition';
    object(object(object(changed).translations)[translation.sync_id!]).definition = 'custom translation';
    await service.override('default', plan.id, 'new-word', item.version, result);
    await service.apply('default', plan.id);
    const active = (await db.manager.find(EnChange)).filter((row) => !row.superseded_at);
    expect(active.map((row) => row.entity).sort()).toEqual(
      [ChangeEntityE.meaning, ChangeEntityE.meaning_translation].sort(),
    );
    for (const change of active) {
      expect(change.contribution).toBeTruthy();
      expect(Object.keys(change.diff)).toEqual(['definition']);
      expect(change.diff.definition.before).toBe(
        change.entity === ChangeEntityE.meaning ? 'upstream definition' : 'upstream translation',
      );
      await db.transaction((em) =>
        withChangeSource({ origin: ChangeOriginE.revert, superseded: true }, () => revertChange(em, change)),
      );
    }
    expect((await db.manager.findOneByOrFail(EnMeaning, { sync_id: meaning.sync_id })).definition).toBe(
      'upstream definition',
    );
    expect(
      (await db.manager.findOneByOrFail(EnMeaningTranslation, { sync_id: translation.sync_id })).definition,
    ).toBe('upstream translation');
    expect(await db.manager.count(EnWord)).toBe(1);
  });

  it('a custom description must not license an automatic upstream meaning as a local contribution', async () => {
    const local = await word(db, 'word', 'base');
    const incoming = await word(source, 'word', 'incoming');
    await source.manager.update(EnWord, incoming.id, { transcription: 'upstream transcription' });
    const meaningId = randomUUID();
    await db.manager.save(EnMeaning, {
      word: local,
      sync_id: meaningId,
      title: 'sense',
      definition: 'base definition',
      sort_order: 1,
    });
    await source.manager.save(EnMeaning, {
      word: incoming,
      sync_id: meaningId,
      title: 'sense',
      definition: 'incoming definition',
      sort_order: 1,
    });
    await service.rememberSource('default');
    await db.manager.update(EnWord, local.id, { description: 'local' });
    const plan = await service.prepareSource('default', source.manager, '1', true);
    const item = (await service.items('default', plan.id, 1)).items[0];
    await service.decide(
      'default',
      plan.id,
      'word',
      item.version,
      item.comparison.conflicts.map((conflict) => ({
        path: conflict.path,
        choice: 'custom',
        result: { present: true, value: 'my hand-written resolution' },
      })),
    );
    await service.apply('default', plan.id);
    const changes = await db.manager.find(EnChange);
    const automatic = changes.find(
      (row) => row.entity === ChangeEntityE.meaning && row.diff.definition?.after === 'incoming definition',
    );
    expect(automatic).toBeDefined();
    expect(automatic!.contribution).toBeNull();
    const custom = changes.find((row) => row.diff.description?.after === 'my hand-written resolution');
    expect(custom?.contribution).toBeTruthy();
    expect(custom?.superseded_at).toBeNull();
    expect(custom?.diff).not.toHaveProperty('transcription');
    const transcription = changes.find((row) => row.diff.transcription?.after === 'upstream transcription');
    expect(transcription).toBeDefined();
    expect(transcription!.contribution).toBeNull();
    expect(transcription!.superseded_at).not.toBeNull();
  });
});
