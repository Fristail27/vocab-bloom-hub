import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { DataSource } from 'typeorm';
import { normalizeStoredWordOrigins } from '../normalize-word-origins';

describe('stored word origin terminology on SQLite', () => {
  let db: DataSource;
  const legacy = {
    id: 'source',
    name: 'Original article',
    scope: 'article',
    licenses: [{ text: 'Keep "article" unchanged.' }],
  };
  const current = { ...legacy, scope: 'word' };
  beforeEach(async () => {
    db = await new DataSource({ type: 'better-sqlite3', database: ':memory:' }).initialize();
    await db.query('CREATE TABLE datasets (id INTEGER PRIMARY KEY, origins TEXT)');
    await db.query('CREATE TABLE en_words (id INTEGER PRIMARY KEY, origins TEXT)');
    await db.query('CREATE TABLE en_changes (id INTEGER PRIMARY KEY, inherited_from TEXT, diff TEXT)');
  });
  afterEach(async () => {
    await db.destroy();
  });

  it('converts origins and history in batches without rewriting source text or grammatical data', async () => {
    await db.query('INSERT INTO datasets VALUES (1, ?)', [JSON.stringify([legacy])]);
    for (let id = 1; id <= 103; id++) {
      await db.query('INSERT INTO en_words VALUES (?, ?)', [id, JSON.stringify([legacy])]);
    }
    const diff = {
      origins: { before: [legacy], after: [legacy] },
      part_of_speech: { before: 'article', after: 'noun' },
    };
    await db.query('INSERT INTO en_changes VALUES (1, ?, ?)', [JSON.stringify(legacy), JSON.stringify(diff)]);
    await db.transaction(normalizeStoredWordOrigins);
    const words = await db.query('SELECT origins FROM en_words');
    expect(words).toHaveLength(103);
    expect(words.every((row: { origins: string }) => row.origins === JSON.stringify([current]))).toBe(true);
    expect(JSON.parse((await db.query('SELECT origins FROM datasets'))[0].origins)).toEqual([current]);
    const [history] = await db.query('SELECT * FROM en_changes');
    expect(JSON.parse(history.inherited_from)).toEqual(current);
    expect(JSON.parse(history.diff)).toEqual({ ...diff, origins: { before: [current], after: [current] } });
    await db.transaction(normalizeStoredWordOrigins);
    expect(await db.query('SELECT * FROM en_changes')).toEqual([history]);
  });
});
