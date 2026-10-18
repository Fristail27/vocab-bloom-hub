import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { DB_ENTITIES } from '../../../../../db/typeorm-options';
import { Dataset } from '../../../../DatasetsModule/entities/dataset.entity';
import { DatasetsService } from '../../../../DatasetsModule/datasets.service';
import { SwitchGate } from '../../../../DatasetsModule/switch-gate';
import { ImportStatusService } from '../../EnImportDictionary/importStatus.service';
import { ReconciliationService } from '../reconciliation.service';
import { EnEntry } from '../../../entities/en_entry.entity';
import { EnWord } from '../../../entities/en_word.entity';
import { EnMeaning } from '../../../entities/en_meaning.entity';
import { EnPartOfSpeechE, EnWordFormsE } from '../../../../../../types';

it('prepares source and parent comparisons with page queries rather than per-article queries', async () => {
  const db = await new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: DB_ENTITIES,
    synchronize: true,
  }).initialize();
  const source = await new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: DB_ENTITIES,
    synchronize: true,
  }).initialize();
  try {
    const dataset = await db.manager.save(Dataset, {
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
    const imports = new ImportStatusService();
    const service = new ReconciliationService(
      {
        find: async () => dataset,
        reader: async () => db,
        gate: new SwitchGate(),
        supported: false,
        reconciliationCommitted: jest.fn(),
        getActive: () => dataset,
      } as unknown as DatasetsService,
      imports,
    );
    const count = 500;
    const meanings = Array.from({ length: count }, () => randomUUID());
    for (const connection of [db, source]) {
      await connection.transaction(async (em) => {
        for (let n = 0; n < count; n++) {
          const entry = await em.save(EnEntry, { word: `word${String(n).padStart(4, '0')}` });
          const word = await em.save(EnWord, {
            word: entry,
            part_of_speech: EnPartOfSpeechE.noun,
            form_of_word: EnWordFormsE.base_form,
            generated: false,
            description: 'same',
          });
          await em.save(EnMeaning, {
            word,
            sync_id: meanings[n],
            sort_order: 0,
            is_obsolete: false,
            title: 'meaning',
            definition: 'definition',
            synonyms: [],
            antonyms: [],
            examples: [],
          });
        }
      });
    }
    let queries = 0;
    jest.spyOn(db.logger, 'logQuery').mockImplementation(() => {
      queries++;
    });
    jest.spyOn(source.logger, 'logQuery').mockImplementation(() => {
      queries++;
    });
    const bounded = async <T>(limit: number, run: () => Promise<T>): Promise<T> => {
      queries = 0;
      const value = await run();
      expect(queries).toBeLessThan(limit);
      return value;
    };
    await bounded(150, () => service.rememberSource('default'));
    await source.manager.update(EnWord, { id: 1 }, { description: 'updated' });
    const plan = await bounded(400, () => service.prepareSource('default', source.manager, '1', true));
    expect(plan.proposed.changed).toBe(1);
    const parent = { ...dataset, name: 'parent', source: 'parent' };
    const parentService = new ReconciliationService(
      {
        find: async (name: string) => (name === 'parent' ? parent : dataset),
        reader: async (target: Dataset) =>
          target.name === 'parent'
            ? {
                transaction: (
                  _isolation: string,
                  run: (em: import('typeorm').EntityManager) => Promise<unknown>,
                ) => source.transaction(run),
              }
            : db,
        supported: true,
      } as unknown as DatasetsService,
      imports,
    );
    const parentPlan = await bounded(400, () => parentService.prepareParent('default', 'parent', true));
    expect(parentPlan.counts.conflicts).toBe(1);
    const unchanged = await db.manager.findOneByOrFail(EnWord, { id: 2 });
    const meaningBefore = await db.manager.findOneByOrFail(EnMeaning, { id: 2 });
    const applied = await bounded(600, () => service.apply('default', plan.id));
    expect(applied.proposed).toEqual({ added: 0, deleted: 0, changed: 1 });
    expect((await db.manager.findOneByOrFail(EnWord, { id: 1 })).description).toBe('updated');
    expect((await db.manager.findOneByOrFail(EnWord, { id: 2 })).updateAt).toEqual(unchanged.updateAt);
    expect(await db.manager.findOneByOrFail(EnMeaning, { id: 2 })).toEqual(meaningBefore);
  } finally {
    await db.destroy();
    await source.destroy();
  }
}, 15000);
