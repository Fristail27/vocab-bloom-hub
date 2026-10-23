import type { EntityManager } from 'typeorm';

export type PgvectorSupportT =
  | { available: false; reason: 'unsupported_database' | 'extension_not_installed' }
  | { available: true; schema: string; version: string };

/** Read-only capability probe. Neither installs an extension nor enables semantic search. */
export async function pgvectorSupport(manager: EntityManager): Promise<PgvectorSupportT> {
  if (manager.connection.options.type !== 'postgres') {
    return { available: false, reason: 'unsupported_database' };
  }
  const rows = (await manager.query(
    `SELECT namespace.nspname AS schema, extension.extversion AS version
       FROM pg_extension extension JOIN pg_namespace namespace ON namespace.oid = extension.extnamespace
      WHERE extension.extname = 'vector'`,
  )) as Array<{ schema: string; version: string }>;
  return rows[0] ? { available: true, ...rows[0] } : { available: false, reason: 'extension_not_installed' };
}
