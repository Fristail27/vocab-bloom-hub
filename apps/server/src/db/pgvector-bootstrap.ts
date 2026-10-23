import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

const logger = new Logger('PgvectorBootstrap');

/** Opt-in startup DDL, separate from migrations and the read-only capability probe. */
export async function preparePgvector(dataSource: DataSource): Promise<void> {
  if (process.env.SEMANTIC_SEARCH_ENABLED?.trim().toLowerCase() !== 'true') return;
  try {
    await dataSource.transaction(async (em) => {
      await em.query("SET LOCAL lock_timeout = '5s'");
      await em.query("SET LOCAL statement_timeout = '30s'");
      const installed = async () =>
        (await em.query("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS installed"))[0]
          .installed as boolean;
      if (await installed()) return;
      // Multiple API processes can start on the same database at once.
      await em.query("SELECT pg_advisory_xact_lock(hashtext('vocab-bloom-hub:pgvector-bootstrap'))");
      if (await installed()) return;
      await em.query('CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public');
      logger.log('Enabled pgvector for semantic search');
    });
  } catch (error) {
    // Rollback finishes before ordinary migrations: optional search cannot poison startup.
    logger.warn(
      `Could not enable pgvector automatically; install its PostgreSQL package and enable the extension with a database administrator. Semantic search remains unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
