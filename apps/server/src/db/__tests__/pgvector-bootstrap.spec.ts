import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { preparePgvector } from '../pgvector-bootstrap';

describe('optional pgvector startup', () => {
  const savedFlag = process.env.SEMANTIC_SEARCH_ENABLED;
  afterEach(() => {
    if (savedFlag === undefined) delete process.env.SEMANTIC_SEARCH_ENABLED;
    else process.env.SEMANTIC_SEARCH_ENABLED = savedFlag;
    jest.restoreAllMocks();
  });
  const source = (installed = false) => {
    const query = jest.fn().mockResolvedValue([{ installed }]);
    const transaction = jest.fn(async (work: (em: unknown) => Promise<void>) => work({ query }));
    return { query, transaction, db: { transaction } as unknown as DataSource };
  };
  it.each([undefined, 'false', '1'])('does not contact the database when disabled (%s)', async (flag) => {
    if (flag === undefined) delete process.env.SEMANTIC_SEARCH_ENABLED;
    else process.env.SEMANTIC_SEARCH_ENABLED = flag;
    const fixture = source();
    await preparePgvector(fixture.db);
    expect(fixture.transaction).not.toHaveBeenCalled();
  });
  it('preserves an existing extension without DDL or an initialization lock', async () => {
    process.env.SEMANTIC_SEARCH_ENABLED = ' TRUE ';
    const fixture = source(true);
    await preparePgvector(fixture.db);
    expect(fixture.query.mock.calls.some(([sql]) => /CREATE EXTENSION|pg_advisory/.test(sql))).toBe(false);
  });
  it('rechecks after serializing concurrent initializers', async () => {
    process.env.SEMANTIC_SEARCH_ENABLED = 'true';
    const fixture = source();
    let probes = 0;
    fixture.query.mockImplementation(async (sql: string) => [
      { installed: sql.includes('SELECT EXISTS') && ++probes > 1 },
    ]);
    await preparePgvector(fixture.db);
    expect(fixture.query.mock.calls.some(([sql]) => sql.includes('pg_advisory_xact_lock'))).toBe(true);
    expect(fixture.query.mock.calls.some(([sql]) => sql.includes('CREATE EXTENSION'))).toBe(false);
  });
  it('activates a missing extension inside the startup transaction', async () => {
    process.env.SEMANTIC_SEARCH_ENABLED = 'true';
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const fixture = source();
    await preparePgvector(fixture.db);
    expect(fixture.query).toHaveBeenCalledWith('CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public');
  });
  it.each([new Error('permission denied'), 'extension package missing'])(
    'keeps failure optional (%s)',
    async (error) => {
      process.env.SEMANTIC_SEARCH_ENABLED = 'true';
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
      const fixture = source();
      fixture.transaction.mockRejectedValue(error);
      await expect(preparePgvector(fixture.db)).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Could not enable pgvector automatically'));
    },
  );
});
