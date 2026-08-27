/**
 * Latency benchmark of the hot API reads on the database DATABASE_URL points
 * at (issue #279) — meant for the full dictionary:
 *
 *   yarn workspace server bench                       # p50 / p95 / max per scenario, queries per request
 *   yarn workspace server bench --iterations 100      # more samples (default 30, after 3 warm-up calls)
 *   yarn workspace server bench --explain             # Postgres: EXPLAIN every query of every scenario,
 *                                                     # report sequential scans over the large tables
 *   yarn workspace server bench --json out.json       # also write the raw numbers
 *
 * The application is bootstrapped like the real server (root .env) and
 * listens on an ephemeral port; requests go through the full HTTP stack, so
 * the numbers include validation, mapping, serialization and compression.
 */
import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(__dirname, '../../../../.env') });
process.env.LOG_LEVEL ??= 'warn';
// the prefix rate limit would cut a long run short; the bench measures the data path
process.env.PUBLIC_API_RATE_LIMIT = '1000000/60';

import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../modules/AppModule/app.module';
import { hashLoginString } from '../../core/utils/crypto';
import { createJwt } from '../../core/utils/auth';
import { checkIsPostgres } from '../../configuration';
import { QueryRecorder } from './query-recorder';
import { explainQuery, findSeqScans, isExplainable, summarizePlan } from './explain';
import { buildScenarios, ScenarioT } from './scenarios';

type ArgsT = { iterations: number; warmup: number; explain: boolean; json?: string };

const parseArgs = (argv: string[]): ArgsT => {
  const args: ArgsT = { iterations: 30, warmup: 3, explain: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--iterations') args.iterations = Number(argv[++i]);
    else if (argv[i] === '--warmup') args.warmup = Number(argv[++i]);
    else if (argv[i] === '--explain') args.explain = true;
    else if (argv[i] === '--json') args.json = argv[++i];
  }
  return args;
};

export type ScenarioResultT = {
  name: string;
  group: ScenarioT['group'];
  status: number;
  queries: number;
  p50: number;
  p95: number;
  max: number;
  seqScans?: string[];
};

const percentile = (sorted: number[], p: number): number =>
  sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];

const round = (ms: number): number => Math.round(ms * 10) / 10;

const adminToken = async (): Promise<string> => {
  const username = process.env.ADMIN_USERNAME ?? '';
  const password = process.env.ADMIN_PASSWORD ?? '';
  const hashByEnv = await hashLoginString(username, password);
  const secretHash = await hashLoginString(username, hashByEnv);
  return createJwt({ role: 'admin' }, secretHash + hashByEnv);
};

const main = async (): Promise<number> => {
  const args = parseArgs(process.argv.slice(2));
  const app = await NestFactory.create(AppModule, { logger: ['warn', 'error'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0);
  const address = app.getHttpServer().address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const dataSource = app.get(DataSource);
  const recorder = new QueryRecorder();
  recorder.attach(dataSource);
  const token = await adminToken();

  const call = async (scenario: ScenarioT): Promise<number> => {
    const res = await fetch(`${base}${scenario.path}`, {
      method: scenario.method,
      headers: {
        'Content-Type': 'application/json',
        ...(scenario.admin && { Authorization: `Bearer ${token}` }),
      },
      ...(scenario.body !== undefined && { body: JSON.stringify(scenario.body) }),
    });
    await res.arrayBuffer();
    return res.status;
  };

  try {
    const run = await fetch(`${base}/api/v1/words/run`).then((r) => r.json());
    const runVerbId = (run.data as Array<{ id: number; part_of_speech: string }>).find(
      (w) => w.part_of_speech === 'verb',
    )?.id;
    if (!runVerbId) throw new Error('The dictionary has no verb "run" — load the full dataset first');

    const scenarios = buildScenarios({ runVerbId });
    const results: ScenarioResultT[] = [];
    console.log(
      `Database: ${checkIsPostgres() ? 'Postgres' : 'SQLite'}; ${args.iterations} iterations after ${args.warmup} warm-up calls\n`,
    );

    for (const scenario of scenarios) {
      let status = 0;
      for (let i = 0; i < args.warmup; i += 1) status = await call(scenario);
      recorder.start();
      status = await call(scenario);
      const queries = recorder.stop();

      const samples: number[] = [];
      for (let i = 0; i < args.iterations; i += 1) {
        const started = performance.now();
        await call(scenario);
        samples.push(performance.now() - started);
      }
      samples.sort((a, b) => a - b);
      const result: ScenarioResultT = {
        name: scenario.name,
        group: scenario.group,
        status,
        queries: queries.length,
        p50: round(percentile(samples, 0.5)),
        p95: round(percentile(samples, 0.95)),
        max: round(samples[samples.length - 1]),
      };

      if (args.explain && checkIsPostgres()) {
        result.seqScans = [];
        for (const query of queries.filter((q) => isExplainable(q.sql))) {
          const plan = await explainQuery(dataSource, query);
          const scans = findSeqScans(plan, query.sql);
          if (scans.length > 0) {
            result.seqScans.push(...scans.map((s) => s.relation));
            console.log(
              `  ! Seq Scan on ${scans.map((s) => s.relation).join(', ')} in: ${query.sql.slice(0, 160)}…`,
            );
            console.log(`    ${summarizePlan(plan).join(' | ')}`);
          }
        }
      }
      results.push(result);
      console.log(
        `${result.name.padEnd(52)} ${String(result.status).padStart(3)}  q=${String(result.queries).padStart(2)}  ` +
          `p50=${String(result.p50).padStart(7)}ms  p95=${String(result.p95).padStart(7)}ms  max=${String(result.max).padStart(7)}ms` +
          (result.seqScans?.length ? `  seq-scans: ${[...new Set(result.seqScans)].join(', ')}` : ''),
      );
    }

    console.log('\n| Scenario | Status | Queries | p50 ms | p95 ms | max ms |');
    console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
    for (const r of results) {
      console.log(`| ${r.name} | ${r.status} | ${r.queries} | ${r.p50} | ${r.p95} | ${r.max} |`);
    }
    if (args.json) {
      writeFileSync(
        args.json,
        `${JSON.stringify({ database: checkIsPostgres() ? 'postgres' : 'sqlite', ...args, results }, null, 2)}\n`,
      );
      console.log(`\nWrote ${args.json}`);
    }
    const failed = results.filter((r) => r.status >= 400);
    return failed.length > 0 ? 1 : 0;
  } finally {
    await app.close();
  }
};

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
}
