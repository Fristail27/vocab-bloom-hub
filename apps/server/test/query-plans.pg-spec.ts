import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, QueryRunner } from 'typeorm';

import { AppModule } from '../src/modules/AppModule/app.module';
import { QueryRecorder, RecordedQueryT } from '../src/bench/query-recorder';
import { buildScenarios, ScenarioT } from '../src/bench/scenarios';
import { findSeqScans, isExplainable, PlanNodeT, summarizePlan } from '../src/bench/explain';
import { hashLoginString } from '../core/utils/crypto';
import { createJwt } from '../core/utils/auth';
import { EnAreaVariantsE, EnPartOfSpeechE, EnWordFormsE } from '../types';

/**
 * Query-plan guard of the public reads (issue #279): every statement a hot
 * endpoint runs must be servable by an index on the large tables. The
 * session disables sequential scans, so the planner picks an index path
 * whenever one exists — on the full dictionary and on the empty database of
 * CI alike — and a `Seq Scan` in a plan means no index can serve the query.
 *
 * The substring search tiers and the fuzzy tier are covered too: since
 * #278 the trigram GIN index serves their LIKEs and the `%` operator. The
 * only statements skipped on purpose are the Last-Modified lookups
 * (`ORDER BY updateAt DESC LIMIT 1`), run at most once a minute behind a cache.
 */
const GUARDED_GROUPS: ScenarioT['group'][] = ['search', 'word', 'list', 'random'];

// `ORDER BY "updateAt" DESC` or the aliased `"EnWord_updateAt" DESC` of a find()
const isLastModifiedLookup = (query: RecordedQueryT): boolean => /updateAt" DESC/.test(query.sql);

const explainOn = async (runner: QueryRunner, query: RecordedQueryT): Promise<PlanNodeT> => {
  const rows = (await runner.query(`EXPLAIN (FORMAT JSON) ${query.sql}`, query.parameters)) as Array<{
    'QUERY PLAN': Array<{ Plan: PlanNodeT }>;
  }>;
  return rows[0]['QUERY PLAN'][0].Plan;
};

describe('query plans of the public reads (Postgres, issue #279)', () => {
  let app: INestApplication<App>;
  let runner: QueryRunner;
  const recorder = new QueryRecorder();
  const auth = { Authorization: '' };
  const server = () => app.getHttpServer();
  let scenarios: ScenarioT[] = [];

  beforeAll(async () => {
    const username = process.env.ADMIN_USERNAME as string;
    const password = process.env.ADMIN_PASSWORD as string;
    const hashByEnv = await hashLoginString(username, password);
    const secretHash = await hashLoginString(username, hashByEnv);
    auth.Authorization = `Bearer ${createJwt({ role: 'admin' }, secretHash + hashByEnv)}`;

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const dataSource = app.get(DataSource);
    recorder.attach(dataSource);
    // one connection for every EXPLAIN, so the SET holds
    runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.query('SET enable_seqscan = off');

    // the scenarios need the verb "run"; a loaded dictionary has it, the
    // empty database of CI gets a minimal one
    const existing = await request(server()).get('/api/v1/words/run');
    let runVerbId = (existing.body.data as Array<{ id: number; part_of_speech: string }> | undefined)?.find(
      (w) => w.part_of_speech === EnPartOfSpeechE.verb,
    )?.id;
    if (!runVerbId) {
      const added = await request(server())
        .post('/api/en/add/word')
        .set(auth)
        .send({
          word: 'run',
          part_of_speech: EnPartOfSpeechE.verb,
          form_of_word: EnWordFormsE.base_form,
          forms: [
            { word: 'ran', form_of_word: EnWordFormsE.past_simple, area_variant: EnAreaVariantsE.common },
          ],
          meanings: [],
        })
        .expect(201);
      runVerbId = (added.body as { id: number }).id;
    }
    scenarios = buildScenarios({ runVerbId }).filter((s) => GUARDED_GROUPS.includes(s.group));
  });

  afterAll(async () => {
    await runner?.release();
    await app?.close();
  });

  it('covers every guarded scenario', () => {
    expect(scenarios.length).toBeGreaterThan(15);
  });

  it('serves every statement of the guarded endpoints through an index on the large tables', async () => {
    const offenders: string[] = [];

    for (const scenario of scenarios) {
      recorder.start();
      const agent = request(server());
      const res = await (
        scenario.method === 'POST' ? agent.post(scenario.path) : agent.get(scenario.path)
      ).send(scenario.body as object | undefined);
      const queries = recorder.stop();
      expect(res.status).toBeLessThan(500);

      for (const query of queries) {
        if (!isExplainable(query.sql) || isLastModifiedLookup(query)) continue;
        const plan = await explainOn(runner, query);
        const scans = findSeqScans(plan, query.sql);
        if (scans.length > 0) {
          offenders.push(
            `${scenario.name}: Seq Scan on ${[...new Set(scans.map((s) => s.relation))].join(', ')}\n` +
              `    ${summarizePlan(plan).join(' | ')}\n    ${query.sql.slice(0, 300)}`,
          );
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
