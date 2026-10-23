import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { prepareDatabase } from '../src/db/datasets';
import { preparePgvector } from '../src/db/pgvector-bootstrap';

/** Requires the pgvector-enabled fixture; never alters the configured database. */
(process.env.TEST_PGVECTOR === 'true' ? describe : describe.skip)('automatic pgvector activation', () => {
  const configured = process.env.DATABASE_URL!;
  const flag = process.env.SEMANTIC_SEARCH_ENABLED;
  const database = `vbh_pgvector_bootstrap_${randomUUID().replaceAll('-', '')}`;
  let admin: DataSource;
  let ds: DataSource;
  let url: string;
  beforeAll(async () => {
    admin = await new DataSource({ type: 'postgres', url: configured }).initialize();
    await admin.query(`CREATE DATABASE "${database}"`);
    const target = new URL(configured);
    target.pathname = `/${database}`;
    url = target.toString();
    ds = await new DataSource({ type: 'postgres', url }).initialize();
  });
  beforeEach(async () => {
    process.env.DATABASE_URL = url;
    process.env.SEMANTIC_SEARCH_ENABLED = 'true';
    await ds.query('DROP EXTENSION IF EXISTS vector CASCADE');
  });
  afterEach(() => {
    process.env.DATABASE_URL = configured;
    if (flag === undefined) delete process.env.SEMANTIC_SEARCH_ENABLED;
    else process.env.SEMANTIC_SEARCH_ENABLED = flag;
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
      await admin.destroy();
    }
  });
  const extension = () =>
    ds.query(
      "SELECT oid, extversion, extnamespace::regnamespace::text AS schema FROM pg_extension WHERE extname='vector'",
    );
  it('enables pgvector during normal preparation of a fresh database', async () => {
    await expect(prepareDatabase()).resolves.toBe('public');
    expect(await extension()).toEqual([expect.objectContaining({ schema: 'public', extversion: '0.8.1' })]);
  });
  it('handles concurrent activation and preserves existing data and the installed extension on restart', async () => {
    await ds.query('CREATE TABLE preserved (value text)');
    await ds.query("INSERT INTO preserved VALUES ('bird')");
    await Promise.all([preparePgvector(ds), preparePgvector(ds)]);
    const before = await extension();
    await prepareDatabase();
    expect(await extension()).toEqual(before);
    expect(await ds.query('SELECT value FROM preserved')).toEqual([{ value: 'bird' }]);
  });
  it('does not activate the extension when semantic search is disabled', async () => {
    process.env.SEMANTIC_SEARCH_ENABLED = 'false';
    await prepareDatabase();
    expect(await extension()).toEqual([]);
  });
  it('rolls back missing-privilege failures and keeps the connection usable', async () => {
    const role = `vbh_limited_${randomUUID().replaceAll('-', '')}`;
    const limited = await new DataSource({ type: 'postgres', url, extra: { max: 1 } }).initialize();
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    await ds.query(`CREATE ROLE "${role}" NOLOGIN`);
    try {
      await limited.query(`SET ROLE "${role}"`);
      await expect(preparePgvector(limited)).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Could not enable pgvector automatically'));
      expect(await limited.query('SELECT 42 AS available')).toEqual([{ available: 42 }]);
      expect(await extension()).toEqual([]);
    } finally {
      await limited.query('RESET ROLE');
      await limited.destroy();
      await ds.query(`DROP ROLE "${role}"`);
    }
  });
  it('keeps an existing extension in its administrator-selected schema', async () => {
    await ds.query('CREATE SCHEMA existing_vectors');
    await ds.query('CREATE EXTENSION vector WITH SCHEMA existing_vectors');
    const before = await extension();
    await preparePgvector(ds);
    expect(await extension()).toEqual(before);
    expect(before[0].schema).toBe('existing_vectors');
  });
});
