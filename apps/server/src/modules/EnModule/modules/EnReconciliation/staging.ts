import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource, EntityManager } from 'typeorm';
import { DB_ENTITIES } from '../../../../db/typeorm-options';
import { randomUUID } from 'node:crypto';
import { transactionDictionaries } from '../../../../db/shared-dictionary/connection';

/** Incoming content is private until its reconciliation plan has been prepared. */
export async function stageDictionary(
  connection: DataSource,
  destination: number,
): Promise<{
  manager: EntityManager;
  destination?: EntityManager;
  publish?: () => Promise<void>;
  close: () => Promise<void>;
}> {
  if (connection.options.type === 'postgres') {
    const runner = connection.createQueryRunner();
    try {
      await runner.startTransaction('REPEATABLE READ');
      const [{ id }] = await runner.query(
        `INSERT INTO public.datasets
        (name, source, own, license, license_url, attribution, is_public)
        VALUES ($1, 'import', true, '', '', '', false) RETURNING id`,
        ['stage_' + randomUUID().replaceAll('-', '')],
      );
      const managerFor = transactionDictionaries(runner);
      return {
        manager: managerFor(id),
        destination: managerFor(destination),
        publish: async () => {
          // The same commit publishes the prepared plan and removes the entire
          // private import. No other session can ever observe the registry row.
          await runner.query('DELETE FROM public.datasets WHERE id=$1', [id]);
          await runner.commitTransaction();
        },
        close: async () => {
          try {
            if (runner.isTransactionActive) await runner.rollbackTransaction();
          } finally {
            await runner.release();
          }
        },
      };
    } catch (error) {
      try {
        if (runner.isTransactionActive) await runner.rollbackTransaction();
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
