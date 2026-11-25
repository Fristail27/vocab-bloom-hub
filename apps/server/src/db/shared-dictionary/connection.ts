import { DataSource, type QueryRunner } from 'typeorm';
import { currentDataset } from '../../core/utils/dataset-scope';

/** The view predicate, its insert default and its write check use this same transaction-local ID. */
export async function selectDictionary(runner: QueryRunner, datasetId: number): Promise<void> {
  if (!Number.isSafeInteger(datasetId) || datasetId < 1) throw new Error('Invalid dictionary owner');
  await runner.query("SELECT set_config('vbh.dataset_id', $1, true)", [String(datasetId)]);
}

/** Repositories and raw SQL share the pool. A runner captures its owner once. Outside
 * an application transaction each statement gets a short transaction of its own.
 * The parameter disappears on commit/rollback, including with transaction pooling.
 */
function scopeRunner(runner: QueryRunner, id: number): QueryRunner {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid dictionary owner');
  const raw = runner.query.bind(runner);
  const query = (sql: string, params?: unknown[], structured?: boolean) =>
    structured ? raw(sql, params, true) : raw(sql, params);
  const start = runner.startTransaction.bind(runner);
  const pin = () => query("SELECT set_config('vbh.dataset_id', $1, true)", [String(id)]);
  runner.startTransaction = async (level) => {
    await idle;
    const nested = runner.isTransactionActive;
    await start(level);
    if (!nested) await pin();
  };
  // A runner can be reused for several reads, including Promise.all. Each
  // standalone transaction must finish before the next starts on this client.
  let idle = Promise.resolve();
  runner.query = (sql: string, params?: unknown[], structured?: boolean) => {
    const transactional = runner.isTransactionActive;
    const work = idle.then(async () => {
      if (transactional) return query(sql, params, structured);
      await query('START TRANSACTION');
      try {
        await pin();
        const result = await query(sql, params, structured);
        await query('COMMIT');
        return result;
      } catch (error) {
        await query('ROLLBACK');
        throw error;
      }
    });
    idle = work.then(
      () => undefined,
      () => undefined,
    );
    return work;
  };
  return runner;
}

function createRunner(source: DataSource, id: number, mode?: 'master' | 'slave') {
  const runner = source.driver.createQueryRunner(mode ?? 'master');
  Object.assign(runner, { manager: source.createEntityManager(runner) });
  return scopeRunner(runner, id);
}

/** Install on the initialized root. Migration connections deliberately operate on physical tables. */
export function enableDictionaryScope(source: DataSource): DataSource {
  if (source.options.type === 'postgres')
    source.createQueryRunner = (mode) => createRunner(source, currentDataset().id, mode);
  return source;
}

/** A named reader/writer has its own manager and immutable owner but borrows the root's driver. */
export function dictionaryConnection(pool: DataSource, id: number): DataSource {
  if (pool.options.type !== 'postgres') return pool;
  const source: DataSource = Object.create(pool);
  Object.assign(source, { manager: source.createEntityManager() });
  source.createQueryRunner = (mode) => createRunner(source, id, mode);
  return source;
}

/** Two owners in one atomic operation (merge, staged import). Interleaved queries
 * share a single transaction, including when the configured pool has one slot.
 * Set the view predicate and issue its query together before releasing the queue.
 */
export function transactionDictionaries(runner: QueryRunner) {
  if (!runner.isTransactionActive) throw new Error('Dictionary transfer requires a transaction');
  let owner: number | undefined;
  let idle = Promise.resolve();
  return (id: number) => {
    const borrowed: QueryRunner = Object.create(runner);
    borrowed.query = (sql: string, params?: unknown[], structured?: boolean) => {
      const work = idle.then(async () => {
        if (owner !== id) {
          await selectDictionary(runner, id);
          owner = id;
        }
        return structured ? runner.query(sql, params, true) : runner.query(sql, params);
      });
      idle = work.then(
        () => undefined,
        () => undefined,
      );
      return work;
    };
    // TypeORM tracks the savepoint depth on the actual runner. Inheriting
    // its methods would split that state between the owner facades.
    borrowed.startTransaction = (level) => runner.startTransaction(level);
    borrowed.commitTransaction = () => runner.commitTransaction();
    borrowed.rollbackTransaction = async () => {
      await runner.rollbackTransaction();
      owner = undefined;
    };
    const manager = runner.connection.createEntityManager(borrowed);
    Object.assign(borrowed, { manager });
    return manager;
  };
}
