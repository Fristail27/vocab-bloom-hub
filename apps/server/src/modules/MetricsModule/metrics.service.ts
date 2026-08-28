import { Injectable, OnModuleDestroy } from '@nestjs/common';
// a default import is the module object itself, whose properties can be replaced
// (a namespace import is a frozen view with getters)
import perfHooks from 'node:perf_hooks';
import { InjectDataSource } from '@nestjs/typeorm';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';
import { DataSource } from 'typeorm';
import { EnStatisticsService } from '../EnModule/modules/EnStatistics/enStatistics.service';
import { checkIsPostgres, getVersion } from '../../../configuration';
import { isMetricsEnabled } from './metrics.config';

// The dictionary counters are a dozen COUNT(*) queries; a scrape every
// 15 s must not run them every time
export const DICTIONARY_METRICS_TTL_MS = 60_000;

// Buckets around the targets of docs/performance.md: lookups in a few ms,
// searches under 100 ms, the long tail up to the 5-minute imports
const DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60];

export type SearchTierT = 'exact' | 'phrasal' | 'prefix' | 'phrase' | 'suffix' | 'contains' | 'fuzzy' | 'none';
export type TransferKindT = 'import' | 'export';
export type TransferResultT = 'success' | 'failure';

type PoolStatsT = { totalCount?: number; idleCount?: number; waitingCount?: number };

/**
 * The Prometheus registry of the instance (issue #281): default Node
 * process metrics, the HTTP metrics fed by the middleware, and the domain
 * metrics the services report — search tiers, dictionary transfers, the
 * dictionary size (refreshed lazily at scrape time) and the Postgres pool.
 */
@Injectable()
export class MetricsService implements OnModuleDestroy {
  readonly registry = new Registry();

  readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Requests answered, by method, route template and status',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });

  readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Time from the first byte of a request to the end of its response',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: DURATION_BUCKETS,
    registers: [this.registry],
  });

  readonly httpRequestsInFlight = new Gauge({
    name: 'http_requests_in_flight',
    help: 'Requests being answered right now',
    registers: [this.registry],
  });

  readonly searchTierHits = new Counter({
    name: 'vbh_search_tier_hits_total',
    help: 'Searches by the tier that produced the top answer (none: nothing matched)',
    labelNames: ['tier', 'short_term'] as const,
    registers: [this.registry],
  });

  readonly transfersTotal = new Counter({
    name: 'vbh_dictionary_transfers_total',
    help: 'Finished dictionary imports and exports, by result',
    labelNames: ['kind', 'result'] as const,
    registers: [this.registry],
  });

  readonly transferInProgress = new Gauge({
    name: 'vbh_dictionary_transfer_in_progress',
    help: '1 while an import or export is running',
    labelNames: ['kind'] as const,
    registers: [this.registry],
  });

  readonly transferProgress = new Gauge({
    name: 'vbh_dictionary_transfer_progress_percent',
    help: 'Progress of the running import or export, 0-100 (stage as a label)',
    labelNames: ['kind', 'stage'] as const,
    registers: [this.registry],
  });

  readonly dictionarySize = new Gauge({
    name: 'vbh_dictionary_size',
    help: 'Rows served by the dictionary, by kind (entries, words, phrases, meanings, ...)',
    labelNames: ['kind'] as const,
    registers: [this.registry],
    collect: async () => this.refreshDictionarySize(),
  });

  readonly dbPool = new Gauge({
    name: 'vbh_db_pool_connections',
    help: 'Postgres connection pool: total, idle and waiting clients (absent on SQLite)',
    labelNames: ['state'] as const,
    registers: [this.registry],
    collect: () => this.refreshPool(),
  });

  private dictionarySizeFetchedAt = 0;

  // the event-loop-lag collector of the default metrics keeps a
  // monitorEventLoopDelay histogram enabled for the life of the process,
  // which holds the event loop open; it is captured here to be disabled on
  // shutdown (tests boot and close the application many times)
  private readonly eventLoopHistograms: perfHooks.IntervalHistogram[] = [];

  constructor(
    private readonly statistics: EnStatisticsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    // the process collectors cost a little on every scrape; nothing scrapes
    // a disabled endpoint
    if (isMetricsEnabled()) this.collectProcessMetrics();
    new Gauge({
      name: 'vbh_build_info',
      help: 'Version and database driver of the running server (always 1)',
      labelNames: ['version', 'database'] as const,
      registers: [this.registry],
    }).set({ version: getVersion(), database: checkIsPostgres() ? 'postgres' : 'sqlite' }, 1);
  }

  onModuleDestroy(): void {
    for (const histogram of this.eventLoopHistograms) histogram.disable();
    this.registry.clear();
  }

  private collectProcessMetrics(): void {
    const original = perfHooks.monitorEventLoopDelay;
    const hooks = perfHooks as { monitorEventLoopDelay: typeof perfHooks.monitorEventLoopDelay };
    hooks.monitorEventLoopDelay = (options) => {
      const histogram = original(options);
      this.eventLoopHistograms.push(histogram);
      return histogram;
    };
    try {
      collectDefaultMetrics({ register: this.registry });
    } finally {
      hooks.monitorEventLoopDelay = original;
    }
  }

  // ----------------------------------------------------------------- http

  observeRequest(method: string, route: string, status: number, seconds: number): void {
    const labels = { method, route, status: String(status) };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, seconds);
  }

  // --------------------------------------------------------------- domain

  searchAnswered(tier: SearchTierT, shortTerm: boolean): void {
    this.searchTierHits.inc({ tier, short_term: String(shortTerm) });
  }

  transferStarted(kind: TransferKindT): void {
    this.transferInProgress.set({ kind }, 1);
    this.transferProgress.reset();
  }

  transferProgressed(kind: TransferKindT, stage: string, percent: number): void {
    this.transferProgress.reset();
    this.transferProgress.set({ kind, stage }, Math.max(0, Math.min(100, percent)));
  }

  transferFinished(kind: TransferKindT, result: TransferResultT): void {
    this.transferInProgress.set({ kind }, 0);
    this.transferProgress.reset();
    this.transfersTotal.inc({ kind, result });
  }

  // ------------------------------------------------------------ collectors

  private async refreshDictionarySize(): Promise<void> {
    if (Date.now() - this.dictionarySizeFetchedAt < DICTIONARY_METRICS_TTL_MS) return;
    const { totals } = await this.statistics.getStatistics();
    for (const [kind, value] of Object.entries(totals)) this.dictionarySize.set({ kind }, value);
    this.dictionarySizeFetchedAt = Date.now();
  }

  private refreshPool(): void {
    const driver = this.dataSource.driver as { master?: PoolStatsT };
    const pool = driver.master;
    if (!pool || typeof pool.totalCount !== 'number') return;
    this.dbPool.set({ state: 'total' }, pool.totalCount ?? 0);
    this.dbPool.set({ state: 'idle' }, pool.idleCount ?? 0);
    this.dbPool.set({ state: 'waiting' }, pool.waitingCount ?? 0);
  }

  /** The exposition text of the whole registry, for GET /metrics */
  async render(): Promise<{ body: string; contentType: string }> {
    return { body: await this.registry.metrics(), contentType: this.registry.contentType };
  }
}
