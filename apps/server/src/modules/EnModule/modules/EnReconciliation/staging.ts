import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource, EntityManager } from 'typeorm';
import { DB_ENTITIES } from '../../../../db/typeorm-options';
import { datasetMigrations } from '../../../../db/dataset-migrations';
import { searchPathOf } from '../../../../db/datasets';

/** Staging is never registered as a dataset and cannot be opened by public readers. */
export async function stageDictionary(
  connection: DataSource,
): Promise<{ manager: EntityManager; close: () => Promise<void> }> {
  if (connection.options.type === 'postgres') {
    const runner = connection.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const schema = `ds_stage_${randomUUID().replaceAll('-', '')}`;
      await runner.query(`CREATE SCHEMA "${schema}"`);
      await runner.query(`SET LOCAL search_path TO ${searchPathOf(schema)}`);
      for (const Migration of datasetMigrations) await new Migration().up(runner);
      return {
        manager: runner.manager,
        close: async () => {
          try {
            await runner.rollbackTransaction();
          } finally {
            await runner.release();
          }
        },
      };
    } catch (error) {
      try {
        await runner.rollbackTransaction();
      } finally {
        await runner.release();
      }
      throw error;
    }
  }
  const dir = await mkdtemp(join(tmpdir(), 'vbh-reconciliation-'));
  const stage = new DataSource({
    type: 'better-sqlite3',
    database: join(dir, 'incoming.sqlite'),
    entities: DB_ENTITIES,
    synchronize: true,
  });
  const close = async () => {
    try {
      if (stage.isInitialized) await stage.destroy();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };
  try {
    await stage.initialize();
    return { manager: stage.manager, close };
  } catch (error) {
    await close();
    throw error;
  }
}
