import { DB_ENTITIES } from '../src/db/typeorm-options';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { datasetMigrations } from '../src/db/dataset-migrations';
import { migrations } from '../src/db/migrations';

const SCHEMA = 'ds_legacy';
const HEADWORD = 'legacy';
describe('migration history of installations predating shared dictionary tables', () => {
  const database = 'vbh_legacy_' + randomUUID().replaceAll('-', '');
  let admin: DataSource, dataSource: DataSource;
  let url: string;
  const runDatasetMigrations = async (schema: string) => {
    const db = await new DataSource({
      type: 'postgres',
      url,
      migrations: datasetMigrations,
      migrationsTableName: 'dataset_migrations',
      extra: { options: `-c search_path=${schema},public` },
    }).initialize();
    try {
      return (await db.runMigrations()).map((migration) => migration.name);
    } finally {
      await db.destroy();
    }
  };
  beforeAll(async () => {
    const address = new URL(process.env.DATABASE_URL!);
    admin = await new DataSource({ type: 'postgres', url: address.toString() }).initialize();
    await admin.query(`CREATE DATABASE "${database}"`);
    address.pathname = '/' + database;
    url = address.toString();
    dataSource = await new DataSource({
      type: 'postgres',
      url,
      entities: DB_ENTITIES,
      migrations: migrations.filter((m) => Number(m.name.slice(-13)) < 1795600000000),
    }).initialize();
    await dataSource.runMigrations();
    await runDatasetMigrations('public');
    await dataSource.query(`CREATE SCHEMA "${SCHEMA}"`);
    await runDatasetMigrations(SCHEMA);
  });
  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
      await admin.destroy();
    }
  });
  it('isolates reciprocal alternatives per schema and rolls their migration down/up', async () => {
    const { replaceAlternatives } = await import('../src/modules/EnModule/utils/entryAlternatives');
    const { AddEntryAlternatives1791400000000 } =
      await import('../src/db/dataset-migrations/1791400000000-AddEntryAlternatives');
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`SET LOCAL search_path TO "${SCHEMA}", public`);
      await runner.query(`INSERT INTO en_entries (word) VALUES ('alt-test-a'), ('alt-test-b')`);
      await replaceAlternatives(runner.manager, new Map([['alt-test-a', ['alt-test-b']]]));
      expect(await runner.query('SELECT word, alternative FROM en_entry_alternatives ORDER BY word')).toEqual([
        { word: 'alt-test-a', alternative: 'alt-test-b' },
        { word: 'alt-test-b', alternative: 'alt-test-a' },
      ]);
      expect(
        await runner.query(`SELECT * FROM public.en_entry_alternatives WHERE word = 'alt-test-a'`),
      ).toEqual([]);
      await runner.query(`DELETE FROM en_entries WHERE word = 'alt-test-b'`);
      expect(await runner.query('SELECT * FROM en_entry_alternatives')).toEqual([]);
      const migration = new AddEntryAlternatives1791400000000();
      await migration.down(runner);
      await migration.up(runner);
      expect(await runner.query('SELECT * FROM en_entry_alternatives')).toEqual([]);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('isolates pronunciations, cascades word deletion and rolls the migration down/up', async () => {
    const { AddWordPronunciations1791700000000 } =
      await import('../src/db/dataset-migrations/1791700000000-AddWordPronunciations');
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`SET LOCAL search_path TO "${SCHEMA}", public`);
      await runner.query(`INSERT INTO en_entries (word) VALUES ('pron-test')`);
      const [word] = await runner.query(
        `INSERT INTO en_words (word, part_of_speech, form_of_word) VALUES ('pron-test', 'noun', 'base_form') RETURNING id`,
      );
      await runner.query(
        `INSERT INTO en_pronunciations (word, type, text, area_variant, sort_order) VALUES ($1, 'ipa', '/pron-test/', 'american', 0)`,
        [word.id],
      );
      expect(await runner.query(`SELECT * FROM public.en_pronunciations WHERE text = '/pron-test/'`)).toEqual(
        [],
      );
      await runner.query('DELETE FROM en_words WHERE id = $1', [word.id]);
      expect(await runner.query('SELECT * FROM en_pronunciations WHERE word = $1', [word.id])).toEqual([]);
      const { AddPronunciationAudio1791800000000 } =
        await import('../src/db/dataset-migrations/1791800000000-AddPronunciationAudio');
      const audioMigration = new AddPronunciationAudio1791800000000();
      await audioMigration.down(runner);
      const migration = new AddWordPronunciations1791700000000();
      await migration.down(runner);
      await migration.up(runner);
      expect(await runner.query('SELECT * FROM en_pronunciations')).toEqual([]);
      await audioMigration.up(runner);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('isolates audio and its license snapshots, cascades cleanup and rolls the audio migration down/up', async () => {
    const { AddPronunciationAudio1791800000000 } =
      await import('../src/db/dataset-migrations/1791800000000-AddPronunciationAudio');
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`SET LOCAL search_path TO "${SCHEMA}", public`);
      await runner.query(`INSERT INTO en_entries (word) VALUES ('audio-test')`);
      const [word] = await runner.query(
        `INSERT INTO en_words (word, part_of_speech, form_of_word) VALUES ('audio-test', 'noun', 'base_form') RETURNING id`,
      );
      const [pronunciation] = await runner.query(
        `INSERT INTO en_pronunciations (word, type, text, area_variant, sort_order) VALUES ($1, 'ipa', NULL, 'common', 0) RETURNING id`,
        [word.id],
      );
      await runner.query(
        `INSERT INTO en_pronunciation_audio (pronunciation, url, sort_order) VALUES ($1, 'https://example.org/audio-test.ogg', 0)`,
        [pronunciation.id],
      );
      expect(
        await runner.query(
          `SELECT * FROM public.en_pronunciation_audio WHERE url = 'https://example.org/audio-test.ogg'`,
        ),
      ).toEqual([]);
      expect(
        (
          await runner.query('SELECT licenses FROM en_pronunciation_audio WHERE pronunciation = $1', [
            pronunciation.id,
          ])
        )[0].licenses,
      ).toBe('[]');
      await runner.query('DELETE FROM en_words WHERE id = $1', [word.id]);
      expect(
        await runner.query('SELECT * FROM en_pronunciation_audio WHERE pronunciation = $1', [pronunciation.id]),
      ).toEqual([]);
      const migration = new AddPronunciationAudio1791800000000();
      await migration.down(runner);
      await migration.up(runner);
      expect(await runner.query('SELECT * FROM en_pronunciation_audio')).toEqual([]);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('isolates etymologies, detaches deleted groups, and rolls the migration down/up', async () => {
    const { AddWordEtymologies1791500000000 } =
      await import('../src/db/dataset-migrations/1791500000000-AddWordEtymologies');
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`SET LOCAL search_path TO "${SCHEMA}", public`);
      await runner.query(`INSERT INTO en_entries (word) VALUES ('etym-test')`);
      const [word] = await runner.query(
        `INSERT INTO en_words (word, part_of_speech, form_of_word) VALUES ('etym-test', 'noun', 'base_form') RETURNING id`,
      );
      const [group] = await runner.query(
        `INSERT INTO en_etymologies (word, number, text) VALUES ($1, 1, 'Invented origin') RETURNING id`,
        [word.id],
      );
      await runner.query(
        `INSERT INTO en_meanings (word, title, definition, sort_order, etymology_id) VALUES ($1, 'Invented meaning', 'Invented definition', 1, $2)`,
        [word.id, group.id],
      );
      expect(await runner.query(`SELECT * FROM public.en_etymologies WHERE text = 'Invented origin'`)).toEqual(
        [],
      );
      await runner.query('DELETE FROM en_etymologies WHERE id = $1', [group.id]);
      expect(await runner.query('SELECT etymology_id FROM en_meanings WHERE word = $1', [word.id])).toEqual([
        { etymology_id: null },
      ]);
      await runner.query(`INSERT INTO en_etymologies (word, number, text) VALUES ($1, 1, 'Another origin')`, [
        word.id,
      ]);
      await runner.query('DELETE FROM en_words WHERE id = $1', [word.id]);
      expect(await runner.query('SELECT * FROM en_etymologies WHERE word = $1', [word.id])).toEqual([]);
      const migration = new AddWordEtymologies1791500000000();
      await migration.down(runner);
      await migration.up(runner);
      expect(await runner.query('SELECT * FROM en_etymologies')).toEqual([]);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('stores ordered quotations only in the selected dataset and rolls their column down/up', async () => {
    const { AddMeaningQuotes1791600000000 } =
      await import('../src/db/dataset-migrations/1791600000000-AddMeaningQuotes');
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`SET LOCAL search_path TO "${SCHEMA}", public`);
      await runner.query(`INSERT INTO en_entries (word) VALUES ('quote-test')`);
      const [word] = await runner.query(
        `INSERT INTO en_words (word, part_of_speech, form_of_word) VALUES ('quote-test', 'noun', 'base_form') RETURNING id`,
      );
      const quotes = [
        { text: 'Invented quotation', reference: 'Invented reference', source_url: 'https://example.org/book' },
        { text: 'Second', reference: null },
      ];
      await runner.query(
        `INSERT INTO en_meanings (word, title, definition, sort_order, quotes) VALUES ($1, 'quote-test', 'Invented definition', 1, $2)`,
        [word.id, JSON.stringify(quotes)],
      );
      expect(await runner.query(`SELECT * FROM public.en_meanings WHERE title = 'quote-test'`)).toEqual([]);
      expect(
        JSON.parse((await runner.query(`SELECT quotes FROM en_meanings WHERE title = 'quote-test'`))[0].quotes),
      ).toEqual(quotes);
      const migration = new AddMeaningQuotes1791600000000();
      await migration.down(runner);
      await migration.up(runner);
      expect(
        (await runner.query(`SELECT quotes FROM en_meanings WHERE title = 'quote-test'`))[0].quotes,
      ).toBeNull();
      expect((await runner.query(`SELECT title FROM en_meanings WHERE title = 'quote-test'`))[0].title).toBe(
        'quote-test',
      );
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('backfills reconciliation counts without inventing causal ancestry for older snapshots', async () => {
    const { RefineReconciliation1792100001000 } =
      await import('../src/db/dataset-migrations/1792100001000-RefineReconciliation');
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`SET LOCAL search_path TO "${SCHEMA}", public`);
      const migration = new RefineReconciliation1792100001000();
      await migration.down(runner);
      await runner.query(`INSERT INTO reconciliation_identity (key, lineage) VALUES ('self', 'legacy')`);
      await runner.query(`INSERT INTO reconciliation_revisions (id, lineage, metadata, complete, sealed)
        VALUES ('count-test-local', 'legacy', '{}', true, true)`);
      await runner.query(`INSERT INTO reconciliation_plans (id, kind, status, lineage, local, incoming, created_at)
        VALUES ('count-test', 'source', 'review', 'legacy', 'count-test-local', 'count-test-local', '2026-10-01')`);
      const cases = [
        {
          headword: 'same',
          local: { a: 1, b: 2 },
          result: { present: true, value: { b: 2, a: 1 } },
          effect: null,
        },
        { headword: 'changed', local: { a: 1 }, result: { present: true, value: { a: 2 } }, effect: 'changed' },
        { headword: 'deleted', local: { a: 1 }, result: { present: false }, effect: 'deleted' },
        { headword: 'added', result: { present: true, value: { a: 1 } }, effect: 'added' },
        { headword: 'tombstone', local: null, result: { present: true, value: { a: 1 } }, effect: 'added' },
        { headword: 'absent', result: { present: false }, effect: null },
      ];
      for (const row of cases) {
        if ('local' in row)
          await runner.query(
            `INSERT INTO reconciliation_records (revision, headword, content, hash)
            VALUES ('count-test-local', $1, $2, 'fixture')`,
            [row.headword, JSON.stringify(row.local)],
          );
        await runner.query(
          `INSERT INTO reconciliation_items (plan, headword, category, comparison, decisions, result, remaining)
          VALUES ('count-test', $1, 'unchanged', '{}', '[]', $2, 0)`,
          [row.headword, JSON.stringify(row.result)],
        );
      }
      await migration.up(runner);
      expect(
        await runner.query(
          `SELECT headword, effect FROM reconciliation_items WHERE plan = 'count-test' ORDER BY headword`,
        ),
      ).toEqual(
        cases
          .map(({ headword, effect }) => ({ headword, effect }))
          .sort((a, b) => a.headword.localeCompare(b.headword)),
      );
      expect(await runner.query(`SELECT heads FROM reconciliation_identity WHERE key = 'self'`)).toEqual([
        { heads: '[]' },
      ]);
      expect(
        await runner.query(`SELECT parents FROM reconciliation_revisions WHERE id = 'count-test-local'`),
      ).toEqual([{ parents: '[]' }]);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('starts the history empty: an entry edited before is not guessed to differ from its source (issue #531)', async () => {
    // the schema as the version before the history left it: no table, two entries, one of them edited
    const { AddReconciliation1792100000000 } =
      await import('../src/db/dataset-migrations/1792100000000-AddReconciliation');
    const { RefineReconciliation1792100001000 } =
      await import('../src/db/dataset-migrations/1792100001000-RefineReconciliation');
    const rollback = dataSource.createQueryRunner();
    await rollback.connect();
    await rollback.startTransaction();
    try {
      await rollback.query(`SET LOCAL search_path TO "${SCHEMA}", public`);
      await new RefineReconciliation1792100001000().down(rollback);
      await new AddReconciliation1792100000000().down(rollback);
      await rollback.query(
        `DELETE FROM dataset_migrations WHERE name IN ('AddReconciliation1792100000000', 'RefineReconciliation1792100001000')`,
      );
      await rollback.commitTransaction();
    } catch (error) {
      await rollback.rollbackTransaction();
      throw error;
    } finally {
      await rollback.release();
    }
    await dataSource.query(`DROP TABLE "${SCHEMA}"."en_changes"`);
    await dataSource.query(`ALTER TABLE "${SCHEMA}"."en_words" DROP COLUMN "origins"`);
    await dataSource.query(
      `DELETE FROM "${SCHEMA}"."dataset_migrations" WHERE "name" IN ('AddChanges1789700000000', 'ChangesCarryValues1789900000000', 'AddWordOrigins1790200000000', 'NormalizeWordOrigins1790200001000', 'AddChangeContribution1790200003000')`,
    );
    await dataSource.query(
      `INSERT INTO "${SCHEMA}"."en_entries" ("word", "user_modified") VALUES ($1, true), ($2, false)`,
      [`${HEADWORD}edited`, `${HEADWORD}plain`],
    );

    try {
      expect(await runDatasetMigrations(SCHEMA)).toEqual([
        'AddChanges1789700000000',
        'ChangesCarryValues1789900000000',
        'AddWordOrigins1790200000000',
        'NormalizeWordOrigins1790200001000',
        'AddChangeContribution1790200003000',
        'AddReconciliation1792100000000',
        'RefineReconciliation1792100001000',
      ]);
      expect(await dataSource.query(`SELECT count(*)::int AS n FROM "${SCHEMA}"."en_changes"`)).toEqual([
        { n: 0 },
      ]);
      // the entry is still kept through an update: that is what its flag says, and all it says
      expect(
        await dataSource.query(
          `SELECT "word" FROM "${SCHEMA}"."en_entries" WHERE "user_modified" = true AND "word" LIKE $1`,
          [`${HEADWORD}%`],
        ),
      ).toEqual([{ word: `${HEADWORD}edited` }]);
      // applied once: a second start has nothing to run
      expect(await runDatasetMigrations(SCHEMA)).toEqual([]);
    } finally {
      await dataSource.query(`DELETE FROM "${SCHEMA}"."en_entries" WHERE "word" LIKE $1`, [`${HEADWORD}%`]);
    }
  });

  it('drops the rows without values an earlier build of the history wrote, and keeps the edits (issue #531)', async () => {
    // the table as that build left it: a guess for an entry flagged `user_modified`, next to a recorded edit
    await dataSource.query(
      `DELETE FROM "${SCHEMA}"."dataset_migrations" WHERE "name" = 'ChangesCarryValues1789900000000'`,
    );
    await dataSource.query(`ALTER TABLE "${SCHEMA}"."en_changes" ALTER COLUMN "diff" DROP NOT NULL`);
    await dataSource.query(
      `INSERT INTO "${SCHEMA}"."en_changes" ("headword", "part_of_speech", "entity", "action", "diff", "origin")
       VALUES ($1, NULL, 'word', 'update', NULL, 'legacy'),
              ($1, 'noun', 'word', 'update', '{"description":{"before":"a","after":"b"}}', 'admin')`,
      [`${HEADWORD}edited`],
    );

    try {
      expect(await runDatasetMigrations(SCHEMA)).toEqual(['ChangesCarryValues1789900000000']);
      expect(
        await dataSource.query(`SELECT "headword", "origin", "part_of_speech" FROM "${SCHEMA}"."en_changes"`),
      ).toEqual([{ headword: `${HEADWORD}edited`, origin: 'admin', part_of_speech: 'noun' }]);
      await expect(
        dataSource.query(
          `INSERT INTO "${SCHEMA}"."en_changes" ("headword", "entity", "action", "origin") VALUES ('x', 'word', 'update', 'admin')`,
        ),
      ).rejects.toThrow(/null value in column "diff"/);
    } finally {
      await dataSource.query(`DELETE FROM "${SCHEMA}"."en_changes"`);
    }
  });
});
