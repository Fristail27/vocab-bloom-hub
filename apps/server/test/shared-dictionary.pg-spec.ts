import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { migrations } from '../src/db/migrations';
import { ShareDictionaryTables1795600000000 } from '../src/db/migrations/1795600000000-ShareDictionaryTables';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/modules/AppModule/app.module';
import { HeadwordReader } from '../src/modules/PublicApiModule/utils/headword-reader';
import { DB_ENTITIES } from '../src/db/typeorm-options';
import { stageDictionary } from '../src/modules/EnModule/modules/EnReconciliation/staging';
import { seedLegacyDatasets } from './harness/legacy-datasets';
import { dictionaryConnection } from '../src/db/shared-dictionary/connection';
import { dictionaryTables } from '../src/db/shared-dictionary/tables';

describe('shared dictionary storage upgrade (#691)', () => {
  const database = 'vbh_upgrade_' + randomUUID().replaceAll('-', '');
  const originalUrl = process.env.DATABASE_URL!;
  const backupTest = process.env.TEST_UPGRADE_BACKUP === 'true' ? it : it.skip;
  const execute = promisify(execFile);
  let backupDir: string | undefined;
  let url: URL;
  let admin: DataSource, db: DataSource;
  beforeAll(async () => {
    url = new URL(originalUrl);
    admin = await new DataSource({ type: 'postgres', url: url.toString() }).initialize();
    await admin.query(`CREATE DATABASE "${database}"`);
    url.pathname = '/' + database;
    db = await new DataSource({
      type: 'postgres',
      url: url.toString(),
      entities: DB_ENTITIES,
      migrations,
    }).initialize();
    await seedLegacyDatasets(db);
    if (process.env.TEST_UPGRADE_BACKUP === 'true') {
      backupDir = await mkdtemp(join(tmpdir(), 'vbh-upgrade-'));
      await execute('pg_dump', ['--format=custom', '--file', join(backupDir, 'legacy.dump'), url.toString()]);
    }
  });
  afterAll(async () => {
    if (backupDir) await rm(backupDir, { recursive: true, force: true });
    if (db?.isInitialized) await db.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
      await admin.destroy();
    }
  });

  it('upgrades a database with partially shared reviews and detects conflicting snapshots', async () => {
    const runner = db.createQueryRunner();
    await runner.startTransaction();
    try {
      await runner.query(`INSERT INTO public.migrations (timestamp, name)
        VALUES (1795600000000, 'ShareContentReviews1795600000000')`);
      await runner.query(`CREATE TABLE public.dictionary_en_content_reviews (
        dataset_id integer NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
        LIKE public.en_content_reviews INCLUDING DEFAULTS INCLUDING CONSTRAINTS,
        PRIMARY KEY (dataset_id, scope, identity))`);
      const [{ id }] = await runner.query("SELECT id FROM datasets WHERE name='parent'");
      await runner.query(
        `INSERT INTO public.dictionary_en_content_reviews (dataset_id, scope, identity, content, checked_at)
        SELECT $1, scope, identity, 'conflict', checked_at FROM ds_parent.en_content_reviews`,
        [id],
      );
      await runner.query(
        `INSERT INTO public.dictionary_en_content_reviews (dataset_id, scope, identity, content, checked_at)
        VALUES ($1, 'definition', 'shared-only', 'extra review', now())`,
        [id],
      );
      await runner.query('SAVEPOINT before_cutover');
      const migration = new ShareDictionaryTables1795600000000();
      await expect(migration.up(runner)).rejects.toThrow(
        'Dictionary copy differs for "ds_parent"."en_content_reviews"',
      );
      await runner.query('ROLLBACK TO SAVEPOINT before_cutover');
      await runner.query(
        `UPDATE public.dictionary_en_content_reviews r SET content = legacy.content
        FROM ds_parent.en_content_reviews legacy WHERE r.dataset_id=$1 AND (r.scope, r.identity)=(legacy.scope, legacy.identity)`,
        [id],
      );
      await migration.up(runner);
      expect(
        await runner.query(`SELECT d.name, r.content FROM public.dictionary_en_content_reviews r
        JOIN public.datasets d ON d.id=r.dataset_id ORDER BY d.name, r.content`),
      ).toEqual([
        { name: 'default', content: 'public' },
        { name: 'fork', content: 'ds_fork' },
        { name: 'parent', content: 'ds_parent' },
        { name: 'parent', content: 'extra review' },
      ]);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('rolls back an incomplete upgrade, retries and preserves dataset-local keys', async () => {
    const run = () => db.runMigrations();
    const legacy = await new DataSource({
      type: 'postgres',
      url: url.toString(),
      entities: DB_ENTITIES,
      extra: { options: '-c search_path=ds_parent,public' },
    }).initialize();
    const parent = HeadwordReader.on(legacy, 'parent');
    const expected = await parent.loadFull([42]);
    const history = await parent.history((await parent.resolve('bank'))!);
    await legacy.destroy();
    const registry = () =>
      db.query('SELECT id, name, source, title, license, is_public FROM datasets ORDER BY id');
    const terms = await registry();
    const oldOrigin = { scope: 'article', licenses: [], attribution: 'article' };
    await db.query("UPDATE datasets SET origins=$1 WHERE name='fork'", [JSON.stringify([oldOrigin])]);
    await db.query('UPDATE ds_fork.en_words SET origins=$1 WHERE id=42', [JSON.stringify([oldOrigin])]);
    await db.query('UPDATE ds_fork.en_changes SET inherited_from=$1', [JSON.stringify(oldOrigin)]);
    await db.query("DELETE FROM ds_fork.dataset_migrations WHERE name='NormalizeWordOrigins1790200001000'");
    await db.query('ALTER TABLE ds_fork.suggestions RENAME COLUMN message TO damaged');
    await expect(run()).rejects.toThrow('Columns differ');
    expect(await db.query("SELECT to_regclass('public.dictionary_en_words') AS copied")).toEqual([
      { copied: null },
    ]);
    await db.query('ALTER TABLE ds_fork.suggestions RENAME COLUMN damaged TO message');
    await run();
    expect(await run()).toEqual([]);
    expect(await registry()).toEqual(terms);
    expect(await db.query("SELECT value FROM settings WHERE field='active_dataset'")).toEqual([
      { value: 'parent' },
    ]);
    process.env.DATABASE_URL = url.toString();
    try {
      const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
      const app = module.createNestApplication();
      try {
        await app.init();
        const http = request(app.getHttpServer());
        const word = await http.get('/api/v1/words/bank').expect(200);
        expect(word.body.data).toEqual(JSON.parse(JSON.stringify(expected)));
        const changes = await http.get('/api/v1/words/bank/history').expect(200);
        expect(changes.body.data).toEqual(JSON.parse(JSON.stringify(history)));
        const groups = await http.get('/api/v1/words/bank/datasets').expect(200);
        expect(groups.body.data.map((row: { dataset: string }) => row.dataset)).toEqual(['default', 'parent']);
        await http.get('/api/v1/words/bank/datasets/fork/history').expect(404);
      } finally {
        await app.close();
      }
    } finally {
      process.env.DATABASE_URL = originalUrl;
    }

    const tables = await db.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND starts_with(tablename,'dictionary_') ORDER BY tablename",
    );
    expect(tables.map((r: { tablename: string }) => r.tablename.slice(11))).toEqual(
      [...dictionaryTables].sort(),
    );
    const banks =
      await db.query(`SELECT ds.name, w.id, m.definition, s.message, t.definition AS translation, r.content AS review, v.embedding
      FROM public.datasets ds JOIN dictionary_en_words w ON w.dataset_id=ds.id
      JOIN dictionary_en_meanings m ON (m.dataset_id,m.word)=(ds.id,w.id)
      JOIN dictionary_en_meanings_translations t ON (t.dataset_id,t.meaning)=(ds.id,m.id)
      JOIN dictionary_suggestions s ON (s.dataset_id,s.word_id)=(ds.id,w.id)
      JOIN dictionary_en_content_reviews r ON (r.dataset_id,r.identity)=(ds.id,m.sync_id)
      JOIN dictionary_en_meaning_embeddings v ON (v.dataset_id,v.meaning_id)=(ds.id,m.id)
      WHERE w.id=42 ORDER BY ds.id`);
    expect(banks).toEqual(
      ['default', 'parent', 'fork'].map((name) => {
        const source = name === 'default' ? 'public' : 'ds_' + name;
        return {
          name,
          id: 42,
          definition: source,
          message: source,
          translation: source,
          review: source,
          embedding: [1, 0],
        };
      }),
    );
    const [{ id: owner }] = await db.query("SELECT id FROM datasets WHERE name='parent'");
    const plans = await db.query(`SELECT ds.name, plan.status, item.remaining, item.version, pending.ordinal
      FROM dictionary_reconciliation_plans plan JOIN datasets ds ON ds.id=plan.dataset_id
      JOIN dictionary_reconciliation_items item ON (item.dataset_id,item.plan)=(ds.id,plan.id)
      JOIN dictionary_reconciliation_embeddings pending ON (pending.dataset_id,pending.plan)=(ds.id,plan.id)
      WHERE item.headword='bank'`);
    expect(plans).toEqual([{ name: 'fork', status: 'review', remaining: 0, version: 1, ordinal: 1 }]);
    const [{ id: fork }] = await db.query("SELECT id FROM datasets WHERE name='fork'");
    const normalized = { ...oldOrigin, scope: 'word' };
    const [origin] = await dictionaryConnection(db, fork)
      .query(`SELECT d.origins AS terms, w.origins, c.inherited_from
      FROM datasets d, en_words w, en_changes c WHERE d.name='fork' AND w.id=42`);
    expect(JSON.parse(origin.terms)).toEqual([normalized]);
    expect(JSON.parse(origin.origins)).toEqual([normalized]);
    expect(JSON.parse(origin.inherited_from)).toEqual(normalized);
    const [{ id: next }] = await dictionaryConnection(db, owner).query(
      `INSERT INTO dictionary_en_words (dataset_id,word,part_of_speech,form_of_word)
      VALUES ($1,'bank','verb','base_form') RETURNING id`,
      [owner],
    );
    expect(next).toBeGreaterThan(101);
    await expect(
      dictionaryConnection(db, fork).query(
        'INSERT INTO dictionary_suggestions (dataset_id,word_id,headword,message) VALUES ($1,$2,$3,$4)',
        [fork, next, 'bank', 'wrong dataset'],
      ),
    ).rejects.toThrow(/foreign key/i);
    await Promise.all(
      [owner, fork].map((id) =>
        db.query('UPDATE dictionary_en_meanings SET definition=$1 WHERE dataset_id=$2 AND id=7', [
          'updated-' + id,
          id,
        ]),
      ),
    );
    expect(
      await db.query('SELECT definition FROM dictionary_en_meanings WHERE dataset_id=$1 AND id=7', [owner]),
    ).toEqual([{ definition: 'updated-' + owner }]);
    await db.query('DELETE FROM public.datasets WHERE id=$1', [fork]);
    expect(
      await db.query('SELECT dataset_id FROM dictionary_en_words WHERE id=42 ORDER BY dataset_id'),
    ).toHaveLength(2);
  });
  it('isolates staged rows, foreign keys and generated IDs from the live dictionary', async () => {
    const [{ id }] = await db.query("SELECT id FROM public.datasets WHERE name='parent'");
    const live = dictionaryConnection(db, id);
    const before = await db.query(
      "SELECT last_id FROM public.dataset_counters WHERE table_name='en_words' ORDER BY dataset_id",
    );
    const stage = await stageDictionary(live, id);
    try {
      expect(await stage.manager.query('SELECT word FROM en_entries')).toEqual([]);
      await stage.manager.query("INSERT INTO en_entries (word) VALUES ('staged')");
      const result = await stage.manager.query(`INSERT INTO en_words (word, part_of_speech, form_of_word)
        VALUES ('staged','noun','base_form') RETURNING id`);
      expect(result).toEqual([{ id: 1 }]);
      expect(await live.query("SELECT word FROM en_entries WHERE word='staged'")).toEqual([]);
      await expect(
        stage.manager.query(
          "INSERT INTO en_meanings (word,title,definition,sort_order) VALUES (42,'bank','cross',1)",
        ),
      ).rejects.toThrow(/foreign key/i);
    } finally {
      await stage.close();
    }
    expect(
      await db.query(
        "SELECT last_id FROM public.dataset_counters WHERE table_name='en_words' ORDER BY dataset_id",
      ),
    ).toEqual(before);
  });
  backupTest('restores the pre-upgrade dump and upgrades that recovered instance', async () => {
    const restoredName = database + '_restored';
    const restoredUrl = new URL(url);
    restoredUrl.pathname = '/' + restoredName;
    await admin.query(`CREATE DATABASE "${restoredName}"`);
    const restored = new DataSource({ type: 'postgres', url: restoredUrl.toString(), migrations });
    try {
      await execute('pg_restore', [
        '--single-transaction',
        '--no-owner',
        '--no-acl',
        '--dbname',
        restoredUrl.toString(),
        join(backupDir!, 'legacy.dump'),
      ]);
      await restored.initialize();
      expect(await restored.query('SELECT word FROM ds_parent.en_words WHERE id=42')).toEqual([
        { word: 'bank' },
      ]);
      expect(await restored.query("SELECT value FROM settings WHERE field='active_dataset'")).toEqual([
        { value: 'parent' },
      ]);
      expect(await restored.query('SELECT status FROM ds_fork.reconciliation_plans')).toEqual([
        { status: 'review' },
      ]);
      await restored.runMigrations();
      expect(await restored.query('SELECT dataset_id FROM dictionary_en_words WHERE id=42')).toHaveLength(3);
    } finally {
      if (restored.isInitialized) await restored.destroy();
      await admin.query(`DROP DATABASE "${restoredName}"`);
    }
  });
});
