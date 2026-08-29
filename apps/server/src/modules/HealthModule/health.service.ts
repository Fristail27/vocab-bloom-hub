import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { getVersion } from '../../../configuration';
import type { HealthResT, ReadyResT } from '../../../types';

// A readiness probe must answer quickly even when the database hangs: past
// this the instance is reported as not ready rather than kept waiting
export const READINESS_QUERY_TIMEOUT_MS = 2_000;

/**
 * Liveness and readiness of the instance (issue #315). Readiness turns
 * negative as soon as a stop begins — `onModuleDestroy` is the first hook
 * Nest runs on SIGTERM, before the HTTP server closes — so a load balancer
 * polling the probe stops routing to a draining process.
 */
@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);
  private shuttingDown = false;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleDestroy(): void {
    this.shuttingDown = true;
  }

  health(): HealthResT {
    return { status: 'ok', version: getVersion() };
  }

  async ready(): Promise<ReadyResT> {
    if (this.shuttingDown) return { status: 'error', reason: 'shutting_down' };
    if (!(await this.isDatabaseReachable())) return { status: 'error', reason: 'database_unreachable' };
    return { status: 'ok' };
  }

  private async isDatabaseReachable(): Promise<boolean> {
    if (!this.dataSource.isInitialized) return false;
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`no answer within ${READINESS_QUERY_TIMEOUT_MS} ms`)),
        READINESS_QUERY_TIMEOUT_MS,
      );
    });
    try {
      await Promise.race([this.dataSource.query('SELECT 1'), timeout]);
      return true;
    } catch (error) {
      this.logger.warn(`Readiness check failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
