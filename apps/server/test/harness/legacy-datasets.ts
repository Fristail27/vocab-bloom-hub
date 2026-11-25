import { Dataset } from '../../src/modules/DatasetsModule/entities/dataset.entity';
import {
  captureCurrent,
  copyRevisionGraph,
} from '../../src/modules/EnModule/modules/EnReconciliation/ancestry';
import { ReconciliationStore } from '../../src/modules/EnModule/modules/EnReconciliation/store';
import { stageEmbeddings } from '../../src/modules/EnModule/modules/EnReconciliation/embeddings';
import type { DataSource, QueryRunner } from 'typeorm';
import { migrations } from '../../src/db/migrations';
import { datasetMigrations } from '../../src/db/dataset-migrations';
import { embeddingInputHash, embeddingProfileId } from '../../src/core/embeddings/profile';

// Reproduce the database shipped before #691 from immutable migration classes.
// Never call the current bootstrap: this fixture must keep exercising upgrades
// after new installations stop creating per-dataset tables.
export async function seedLegacyDatasets(db: DataSource): Promise<void> {
  const runner = db.createQueryRunner();
  await runner.startTransaction();
  try {
    await runner.query(
      'CREATE TABLE migrations (id serial PRIMARY KEY, timestamp bigint NOT NULL, name varchar NOT NULL)',
    );
    for (const Migration of migrations.filter((m) => Number(m.name.slice(-13)) <= 1792000000000)) {
      await new Migration().up(runner);
      await runner.query('INSERT INTO migrations (timestamp, name) VALUES ($1,$2)', [
        Migration.name.slice(-13),
        Migration.name,
      ]);
    }
    await runner.query(`INSERT INTO datasets (name, schema, source, title, license, license_url, attribution, own, is_public)
      VALUES ('parent', 'ds_parent', 'parent', 'Parent', 'CC0-1.0', '', 'Fixture author', true, true),
             ('fork', 'ds_fork', 'fork', 'Fork', 'CC0-1.0', '', 'Fixture author', true, false)`);
    await runner.query("UPDATE settings SET value = 'parent' WHERE field = 'active_dataset'");
    for (const schema of ['public', 'ds_parent', 'ds_fork']) {
      if (schema !== 'public') await runner.query(`CREATE SCHEMA "${schema}"`);
      await runner.query(`SET LOCAL search_path TO "${schema}", public`);
      if (schema !== 'public')
        await runner.query(
          'CREATE TABLE dataset_migrations (id serial PRIMARY KEY, timestamp bigint NOT NULL, name varchar NOT NULL)',
        );
      for (const Migration of datasetMigrations.filter((m) => Number(m.name.slice(-13)) <= 1792700001000)) {
        const migration = new Migration();
        if (schema === 'public' && migration.name.startsWith('DatasetBaseline')) continue;
        await migration.up(runner);
        await runner.query('INSERT INTO dataset_migrations (timestamp, name) VALUES ($1,$2)', [
          migration.name.slice(-13),
          migration.name,
        ]);
      }
      await seedRows(runner, schema);
    }
    await runner.commitTransaction();
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
  await db.transaction(async (source) => {
    await source.query('SET LOCAL search_path TO ds_parent, public');
    const parent = await source.findOneByOrFail(Dataset, { name: 'parent' });
    const ancestor = await captureCurrent(source, parent);
    await source.query("UPDATE en_words SET description='incoming description' WHERE id=42");
    const incoming = await captureCurrent(source, parent);
    await db.transaction(async (target) => {
      await target.query('SET LOCAL search_path TO ds_fork, public');
      const fork = await target.findOneByOrFail(Dataset, { name: 'fork' });
      const local = await captureCurrent(target, fork);
      const store = new ReconciliationStore(target);
      await copyRevisionGraph(source, target, incoming.id);
      await store.establish(ancestor.lineage, ancestor.id);
      const plan = await store.prepare('parent', local.id, incoming.id);
      await store.override(plan.id, 'bank', 0, await store.side(incoming.id, 'bank'));
      await stageEmbeddings(target, source, plan.id);
    });
  });
}

async function seedRows(runner: QueryRunner, schema: string) {
  const identity = '1575d09b-ec54-4710-8b0e-a877bbe1beee';
  await runner.query("INSERT INTO en_entries (word) VALUES ('bank'), ('banks')");
  await runner.query(
    `INSERT INTO en_words (id, word, part_of_speech, form_of_word, description)
    VALUES (42, 'bank', 'noun', 'base_form', $1)`,
    [schema],
  );
  await runner.query(`INSERT INTO en_words (id, word, part_of_speech, form_of_word, "baseFormId")
    VALUES (43, 'banks', 'noun', 'plural_form', 42)`);
  await runner.query("SELECT setval(pg_get_serial_sequence('en_words','id'), 101)");
  await runner.query(
    `INSERT INTO en_meanings (id, word, title, definition, sort_order, sync_id)
    VALUES (7, 42, 'bank', $1, 0, $2)`,
    [schema, identity],
  );
  await runner.query(
    `INSERT INTO en_meanings_translations (meaning, language, title, definition)
    VALUES (7, 'ru', 'берег', $1)`,
    [schema],
  );
  await runner.query(`INSERT INTO suggestions (word_id, headword, message) VALUES (42, 'bank', $1)`, [schema]);
  await runner.query(`INSERT INTO en_changes (headword, part_of_speech, entity, action, diff, origin)
    VALUES ('bank', 'noun', 'word', 'update', '{"description":{"before":"old","after":"new"}}', 'admin')`);
  await runner.query(
    `INSERT INTO en_content_reviews (scope, identity, content, checked_at)
    VALUES ('definition', $1, $2, now())`,
    [identity, schema],
  );
  const profile = {
    model: 'fixture',
    revision: 'a'.repeat(64),
    dimensions: 2,
    normalization: 'l2' as const,
    document_format: 'meaning-v1',
    query_format: 'search-query-v1',
  };
  const profileId = embeddingProfileId(profile);
  await runner.query('INSERT INTO en_embedding_profiles VALUES ($1,$2,$3,$4,$5,$6,$7)', [
    profileId,
    profile.model,
    profile.revision,
    profile.dimensions,
    profile.normalization,
    profile.document_format,
    profile.query_format,
  ]);
  await runner.query('INSERT INTO en_meaning_embeddings VALUES ($1,7,2,$2,$3)', [
    profileId,
    embeddingInputHash(`title: bank (noun) | text: bank. ${schema}`),
    [1, 0],
  ]);
}
