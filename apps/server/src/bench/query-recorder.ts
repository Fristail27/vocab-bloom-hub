import type { DataSource, Logger, QueryRunner } from 'typeorm';

export type RecordedQueryT = { sql: string; parameters: unknown[] };

/**
 * A TypeORM logger that keeps every statement the data source runs while
 * recording. Attached to a running application it tells, per HTTP
 * request, how many queries an endpoint costs (the N+1 audit of issue
 * #279) and hands the exact SQL with its parameters to EXPLAIN.
 */
export class QueryRecorder implements Logger {
  private recording = false;

  private queries: RecordedQueryT[] = [];

  /** Replaces the data source's logger; every later query is seen by this recorder */
  attach(dataSource: DataSource): void {
    dataSource.logger = this;
  }

  start(): void {
    this.queries = [];
    this.recording = true;
  }

  stop(): RecordedQueryT[] {
    this.recording = false;
    return this.queries;
  }

  logQuery(query: string, parameters?: unknown[], _queryRunner?: QueryRunner): void {
    if (this.recording) this.queries.push({ sql: query, parameters: parameters ?? [] });
  }

  logQueryError(): void {}

  logQuerySlow(): void {}

  logSchemaBuild(): void {}

  logMigration(): void {}

  log(): void {}
}
