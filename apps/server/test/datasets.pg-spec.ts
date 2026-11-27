import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/modules/AppModule/app.module';
import { DatasetsService } from '../src/modules/DatasetsModule/datasets.service';
import { prepareDatabase } from '../src/db/datasets';
import { createJwt } from '../core/utils/auth';
import { hashLoginString } from '../core/utils/crypto';
import {
  DatasetsListT,
  EnAreaVariantsE,
  EnPartOfSpeechE,
  EnWordFormsE,
  PublicWordDatasetsV1ResT,
  DictionaryApiV2DatasetsResT,
  FreeDictionaryDatasetsResT,
} from '../types';

/**
 * Datasets as Postgres schemas (issue #527): what installing, activating
 * and deleting a dataset does in the database. The suite may run against a
 * loaded dictionary, so it never writes to the default dataset: it installs
 * two datasets of the catalog, works in them and removes them — and refuses
 * to start on an instance that holds either, which it would delete.
 */
const NAME = 'wordnet_princeton';
const IMPORTED = 'wordnet';
const HEADWORD = `zzpgspec${Date.now().toString(36)}`;

const DICTIONARY_TABLES = [
  'en_entry_alternatives',
  'en_entries',
  'en_words',
  'en_etymologies',
  'en_pronunciations',
  'en_pronunciation_audio',
  'en_meanings',
  'en_meanings_translations',
  'en_short_translations',
  'en_meaning_synonyms',
  'en_meaning_antonyms',
  'suggestions',
  // the history of edits (issue #531)
  'en_changes',
  'en_content_reviews',
  'en_embedding_profiles',
  'en_meaning_embeddings',
  'reconciliation_embeddings',
  'reconciliation_identity',
  'reconciliation_revisions',
  'reconciliation_records',
  'reconciliation_baselines',
  'reconciliation_plans',
  'reconciliation_items',
];

describe('shared dictionary tables (Postgres, issue #527)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const auth = { Authorization: '' };
  const server = () => app.getHttpServer();

  const list = async (): Promise<DatasetsListT> =>
    (await request(server()).get('/api/en/datasets').set(auth).expect(200)).body as DatasetsListT;

  const rateLimit = process.env.PUBLIC_API_RATE_LIMIT;
  const reader = async (name: string) => {
    const datasets = app.get(DatasetsService);
    return datasets.reader(await datasets.find(name));
  };
  beforeAll(async () => {
    // the suite reads the public API more often in a minute than a client may
    process.env.PUBLIC_API_RATE_LIMIT = '100000/60';
    const username = process.env.ADMIN_USERNAME as string;
    const password = process.env.ADMIN_PASSWORD as string;
    const hashByEnv = await hashLoginString(username, password);
    const secretHash = await hashLoginString(username, hashByEnv);
    auth.Authorization = `Bearer ${createJwt({ role: 'admin' }, secretHash + hashByEnv)}`;

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    dataSource = app.get(DataSource);

    const held = (await list()).datasets.filter(
      (dataset) => dataset.installed && [NAME, IMPORTED].includes(dataset.name),
    );
    if (held.length) {
      await app.close();
      throw new Error(
        `The database holds the dataset(s) ${held.map((dataset) => dataset.name).join(', ')}: ` +
          'this suite installs and deletes them. Run it against a database without them.',
      );
    }
    owned = true;
  });

  // set once the suite knows the datasets it removes are its own
  let owned = false;

  afterAll(async () => {
    if (rateLimit === undefined) delete process.env.PUBLIC_API_RATE_LIMIT;
    else process.env.PUBLIC_API_RATE_LIMIT = rateLimit;
    if (!owned) return;
    // whatever failed above, the instance goes back to what it served and the test datasets go
    await request(server()).post('/api/en/datasets/default/activate').set(auth);
    for (const name of [NAME, IMPORTED]) {
      await request(server()).delete(`/api/en/datasets/${name}`).set(auth);
    }
    await app.close();
  });

  it('registered `public` as the default dataset, its dictionary tables marked as built', async () => {
    const { supported, datasets } = await list();
    expect(supported).toBe(true);
    expect(datasets[0]).toEqual(
      expect.objectContaining({ name: 'default', is_default: true, license: 'CC-BY-4.0' }),
    );

    const journal = (await dataSource.query(`SELECT "name" FROM "public"."migrations"`)) as Array<{
      name: string;
    }>;
    expect(journal.map((row) => row.name)).toContain('ShareDictionaryTables1795600000000');
  });

  it('installs a dataset as an empty partition of the shared dictionary tables', async () => {
    const created = await app.get(DatasetsService).install(NAME);
    expect(created.is_public).toBe(false);
    await app.get(DatasetsService).setVisibility(NAME, true);
    expect(created).toEqual(
      expect.objectContaining({ name: NAME, source: 'princeton-wordnet', version: null }),
    );
    expect((await list()).datasets.find((dataset) => dataset.name === NAME)).toEqual(
      expect.objectContaining({
        name: NAME,
        installed: true,
        source: 'princeton-wordnet',
        license: 'WordNet',
        active: false,
        is_default: false,
        version: null,
      }),
    );

    const tables: { tablename: string }[] = await dataSource.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND starts_with(tablename,'dictionary_')",
    );
    expect(tables.map((row) => row.tablename.slice(11)).sort()).toEqual([...DICTIONARY_TABLES].sort());
    expect(await (await reader(NAME)).query('SELECT * FROM en_entries')).toEqual([]);

    // installed twice is installed once; a name the catalog does not have is no dataset
    expect((await app.get(DatasetsService).install(NAME)).id).toBe(created.id);
    await expect(app.get(DatasetsService).install('wiktionary_en')).rejects.toThrow('dataset_name_invalid');
    await expect(app.get(DatasetsService).install('default')).rejects.toThrow('dataset_name_invalid');
  });

  it('preserves existing public datasets when applying the visibility migration', async () => {
    const { AddDatasetVisibility1792000000000 } =
      await import('../src/db/migrations/1792000000000-AddDatasetVisibility');
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const migration = new AddDatasetVisibility1792000000000();
      await migration.down(runner);
      await migration.up(runner);
      const rows = await runner.query('SELECT is_public, visibility_updated_at FROM public.datasets');
      expect(rows.length).toBeGreaterThan(0);
      expect(
        rows.every(
          (row: { is_public: boolean; visibility_updated_at: Date | null }) =>
            row.is_public && row.visibility_updated_at === null,
        ),
      ).toBe(true);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('serves the active dataset only: a word written to one is not in the other', async () => {
    const before = await (await reader('default')).query(`SELECT count(*)::int AS n FROM "en_words"`);

    const activated = await request(server()).post(`/api/en/datasets/${NAME}/activate`).set(auth).expect(200);
    expect(activated.body).toEqual(expect.objectContaining({ name: NAME, active: true }));
    expect((await list()).active).toBe(NAME);
    expect(await dataSource.query('SELECT dictionary_dataset_id() AS id')).toEqual([
      { id: (await app.get(DatasetsService).find(NAME)).id },
    ]);

    // an empty dataset: nothing of the default one shows through
    await request(server()).get(`/api/v1/words/${HEADWORD}`).expect(404);
    const meta = await request(server()).get('/api/v1/meta').expect(200);
    expect(meta.body.data.counts.entries).toBe(0);

    await request(server())
      .post('/api/en/add/word')
      .set(auth)
      .send({
        word: HEADWORD,
        part_of_speech: EnPartOfSpeechE.noun,
        form_of_word: EnWordFormsE.base_form,
        forms: [],
        meanings: [
          {
            title: 'a test word',
            definition: 'a word that exists in one dataset only',
            is_obsolete: false,
            sort_order: 1,
            examples: [],
            area_variant: EnAreaVariantsE.common,
            translations: [],
          },
        ],
        short_translations: [],
      })
      .expect(201);
    const found = await request(server()).get(`/api/v1/words/${HEADWORD}`).expect(200);
    expect(found.body.data[0].word).toBe(HEADWORD);
    expect(await (await reader(NAME)).query(`SELECT count(*)::int AS n FROM "en_words"`)).toEqual([{ n: 1 }]);
    // the history of the edit lies with the dataset it was made in, and nowhere else (issue #531)
    const changesBefore = await (
      await reader('default')
    ).query(`SELECT count(*)::int AS n FROM "en_changes" WHERE "headword" = $1`, [HEADWORD]);
    expect(changesBefore).toEqual([{ n: 0 }]);
    expect(await (await reader(NAME)).query(`SELECT "headword", "entity", "action" FROM "en_changes"`)).toEqual(
      [{ headword: HEADWORD, entity: 'word', action: 'create' }],
    );

    // …and back: the default dataset never saw the word, its rows are what they were
    await request(server()).post('/api/en/datasets/default/activate').set(auth).expect(200);
    expect(await dataSource.query('SELECT current_schema() AS s')).toEqual([{ s: 'public' }]);
    await request(server()).get(`/api/v1/words/${HEADWORD}`).expect(404);
    expect(await (await reader('default')).query(`SELECT count(*)::int AS n FROM "en_words"`)).toEqual(before);
    const setting = await dataSource.query(
      `SELECT "value" FROM "public"."settings" WHERE "field" = 'active_dataset'`,
    );
    expect(setting).toEqual([{ value: 'default' }]);
  });

  it('projects an inactive schema through both compatibility adapters without switching it', async () => {
    const dictionaryUrl = `/api/compat/dictionaryapi/v2/entries/en/${HEADWORD}`;
    const freeUrl = `/api/compat/freedictionaryapi/v1/entries/en/${HEADWORD}`;
    const comparison = await request(server()).get(`${dictionaryUrl}/datasets`).expect(200);
    const group = (comparison.body as DictionaryApiV2DatasetsResT).data.find((d) => d.dataset === NAME)!;
    expect(group).toMatchObject({ active: false, status: 200, source: 'princeton-wordnet' });
    expect(app.get(DatasetsService).getActive().name).toBe('default');
    const freeComparison = await request(server()).get(`${freeUrl}/datasets`).expect(200);
    const freeGroup = (freeComparison.body as FreeDictionaryDatasetsResT).data.find((d) => d.dataset === NAME)!;
    expect(freeGroup.response.entries[0].vocabBloom.source).toBe('princeton-wordnet');
    try {
      await request(server()).post(`/api/en/datasets/${NAME}/activate`).set(auth).expect(200);
      const direct = await request(server()).get(dictionaryUrl).expect(200);
      expect(group.response).toEqual(direct.body);
      const freeDirect = await request(server()).get(freeUrl).expect(200);
      expect(freeGroup.response).toEqual({
        ...freeDirect.body,
        vocabBloom: { ...freeDirect.body.vocabBloom, active: false },
      });
    } finally {
      await request(server()).post('/api/en/datasets/default/activate').set(auth).expect(200);
    }
  });

  it('keeps the histories apart: an edit marks the word in its dataset only, a name leaves them all (issue #531)', async () => {
    const SHARED = 'dataset-shared-word';
    // the same headword in both datasets, as two sources both have "run"; no history yet
    for (const dataset of ['default', NAME]) {
      await (await reader(dataset)).query(`INSERT INTO "en_entries" ("word") VALUES ($1)`, [SHARED]);
      await (
        await reader(dataset)
      ).query(
        `INSERT INTO "en_words" ("word", "part_of_speech", "form_of_word", "description", "generated")
         VALUES ($1, 'noun', 'base_form', 'what the source says', false)`,
        [SHARED],
      );
    }
    const readers = async () => {
      const word = await request(server()).get(`/api/v1/words/${SHARED}`).expect(200);
      const history = await request(server()).get(`/api/v1/words/${SHARED}/history`).expect(200);
      return { word: word.body.data[0], history: history.body.data };
    };

    try {
      await request(server()).post(`/api/en/datasets/${NAME}/activate`).set(auth).expect(200);
      const { word } = await readers();
      await request(server())
        .patch(`/api/en/common-info/${word.id}`)
        .set(auth)
        .send({ description: 'what the owner says' })
        .expect(200);

      const edited = await readers();
      expect(edited.word).toEqual(
        expect.objectContaining({ description: 'what the owner says', modified: true }),
      );
      expect(edited.history).toEqual([
        expect.objectContaining({
          entity: 'word',
          action: 'update',
          diff: { description: { before: 'what the source says', after: 'what the owner says' } },
        }),
      ]);

      // the other dataset has the word as its source has it, and no history of it
      await request(server()).post('/api/en/datasets/default/activate').set(auth).expect(200);
      const untouched = await readers();
      expect(untouched.word).toEqual(
        expect.objectContaining({ description: 'what the source says', modified: false }),
      );
      expect(untouched.history).toEqual([]);
      const listed = await request(server()).get(`/api/en/changes?headword=${SHARED}`).set(auth).expect(200);
      expect(listed.body.total).toBe(0);

      // a name is taken out of every dataset of the instance, the active one or not
      for (const dataset of ['default', NAME]) {
        await (
          await reader(dataset)
        ).query(
          `INSERT INTO "en_changes" ("headword", "part_of_speech", "entity", "action", "diff", "origin", "author")
           VALUES ($1, 'noun', 'word', 'update', '{"transcription":{"before":null,"after":"x"}}', 'suggestion', 'Ada Lovelace')`,
          [SHARED],
        );
      }
      await request(server())
        .post('/api/en/changes/forget-author')
        .set(auth)
        .send({ author: 'Ada Lovelace' })
        .expect(200)
        .expect({ success: true, forgotten: 2 });
      for (const dataset of ['default', NAME]) {
        expect(
          await (
            await reader(dataset)
          ).query(`SELECT count(*)::int AS n FROM "en_changes" WHERE "author" IS NOT NULL`),
        ).toEqual([{ n: 0 }]);
      }

      // taking the edit back in its dataset: jsonb keeps no order of keys, the values are compared all the same
      await request(server()).post(`/api/en/datasets/${NAME}/activate`).set(auth).expect(200);
      const own = await request(server()).get(`/api/en/changes?headword=${SHARED}`).set(auth).expect(200);
      const edit = (own.body.items as Array<{ id: number; origin: string }>).find(
        (item) => item.origin === 'admin',
      );
      // the row of the reader came later and is about another field
      await request(server()).post(`/api/en/changes/${edit?.id}/revert`).set(auth).expect(200);
      expect((await readers()).word).toEqual(expect.objectContaining({ description: 'what the source says' }));
    } finally {
      await request(server()).post('/api/en/datasets/default/activate').set(auth).expect(200);
      for (const dataset of ['default', NAME]) {
        await (await reader(dataset)).query(`DELETE FROM "en_changes" WHERE "headword" = $1`, [SHARED]);
        await (await reader(dataset)).query(`DELETE FROM "en_words" WHERE "word" = $1`, [SHARED]);
        await (await reader(dataset)).query(`DELETE FROM "en_entries" WHERE "word" = $1`, [SHARED]);
      }
    }
  });

  it('keeps phrasal variants inside their dataset in admin reads and public dataset groups', async () => {
    const base = `${HEADWORD}phrasal`;
    const names = [base, `${base} up`, `${base} out`];
    const write = async (dataset: string, word: string, baseId: number | null = null): Promise<number> => {
      await (await reader(dataset)).query(`INSERT INTO "en_entries" ("word") VALUES ($1)`, [word]);
      const [row] = (await (
        await reader(dataset)
      ).query(
        `INSERT INTO "en_words"
          ("word", "part_of_speech", "form_of_word", "generated", "basePhrasalId", "verb___is_phrasal")
         VALUES ($1, 'verb', 'base_form', false, $2, $3) RETURNING id`,
        [word, baseId, baseId !== null],
      )) as Array<{ id: number }>;
      return row.id;
    };
    const groups = async () => {
      const res = await request(server()).get(`/api/v1/words/${base}/datasets`).expect(200);
      return (res.body as PublicWordDatasetsV1ResT).data.map((group) => [
        group.dataset,
        group.entries[0]?.phrasal_variants,
      ]);
    };
    try {
      const defaultId = await write('default', base);
      await write('default', names[1], defaultId);
      const otherId = await write(NAME, base);
      // Even a matching spelling in the other dataset is not a phrasal variant without its own link.
      await write(NAME, names[1]);
      expect(await groups()).toEqual([
        ['default', [names[1]]],
        [NAME, []],
      ]);
      const empty = await request(server()).get(`/api/en/${otherId}?dataset=${NAME}`).set(auth).expect(200);
      expect(empty.body.phrasal_variants).toEqual([]);

      await write(NAME, names[2], otherId);
      const expected = [
        ['default', [names[1]]],
        [NAME, [names[2]]],
      ];
      expect(await groups()).toEqual(expected);
      const own = await request(server()).get(`/api/en/${otherId}?dataset=${NAME}`).set(auth).expect(200);
      expect(own.body.phrasal_variants).toEqual([names[2]]);

      await request(server()).post(`/api/en/datasets/${NAME}/activate`).set(auth).expect(200);
      expect(await groups()).toEqual(expected);
      const active = await request(server()).get(`/api/v1/words/${base}`).expect(200);
      expect(active.body.data[0].phrasal_variants).toEqual([names[2]]);
      const original = await request(server())
        .get(`/api/en/${defaultId}?dataset=default`)
        .set(auth)
        .expect(200);
      expect(original.body.phrasal_variants).toEqual([names[1]]);
    } finally {
      await request(server()).post('/api/en/datasets/default/activate').set(auth).expect(200);
      for (const dataset of ['default', NAME]) {
        await (await reader(dataset)).query(`DELETE FROM "en_entries" WHERE "word" = ANY($1)`, [names]);
      }
    }
  });

  it('reads a headword from every dataset at once: a group per dataset, under its own terms (issue #528)', async () => {
    const BOTH = `${HEADWORD}both`;
    const PROPER = `${BOTH[0].toUpperCase()}${BOTH.slice(1)}`;
    const ONE = `${HEADWORD}one`;
    const write = async (dataset: string, word: string, description: string) => {
      await (await reader(dataset)).query(`INSERT INTO "en_entries" ("word") VALUES ($1)`, [word]);
      await (
        await reader(dataset)
      ).query(
        `INSERT INTO "en_words" ("word", "part_of_speech", "form_of_word", "description", "generated")
         VALUES ($1, 'noun', 'base_form', $2, false)`,
        [word, description],
      );
    };
    const read = async (word: string) =>
      (await request(server()).get(`/api/v1/words/${word}/datasets`).expect(200))
        .body as PublicWordDatasetsV1ResT;

    // one spelling in the default dataset; two that differ by case in the other, as a public source has them
    await write('default', BOTH, 'what the project says');
    await write(NAME, BOTH, 'what the source says');
    await write(NAME, PROPER, 'a name');
    await write(NAME, ONE, 'a word of one dataset');
    await (
      await reader(NAME)
    ).query(
      `INSERT INTO "en_changes" ("headword", "part_of_speech", "entity", "action", "diff", "origin")
       VALUES ($1, 'noun', 'word', 'update', '{"description":{"before":"said before","after":"what the source says"}}', 'admin')`,
      [BOTH],
    );

    try {
      const { data, meta } = await read(BOTH);
      expect(meta).toEqual({ word: BOTH, datasets: 2, found: 2 });
      expect(data.map((group) => [group.dataset, group.active, group.source, group.license])).toEqual([
        ['default', true, 'vocab-bloom-hub', 'CC-BY-4.0'],
        [NAME, false, 'princeton-wordnet', 'WordNet'],
      ]);
      // the notice a source asks to be kept in full travels with its group, and with no other
      expect(data[0].license_text).toBe('');
      expect(data[1].license_text).toContain('Princeton University');
      expect(data[1].attribution).toContain('WordNet');

      // the spelling is matched inside each dataset
      expect(data.map((group) => [group.word, group.variants, group.count])).toEqual([
        [BOTH, [], 1],
        [BOTH, [PROPER], 1],
      ]);
      // an entry says what its own dataset says of it: the source, and whether it was changed there
      expect(data.map((group) => group.entries.map((e) => [e.description, e.source, e.modified]))).toEqual([
        [['what the project says', 'vocab-bloom-hub', false]],
        [['what the source says', 'princeton-wordnet', true]],
      ]);

      const proper = await read(PROPER);
      expect(proper.meta).toEqual({ word: PROPER, datasets: 2, found: 2 });
      expect(proper.data.map((group) => [group.word, group.entries.map((e) => e.description)])).toEqual([
        [BOTH, ['what the project says']],
        [PROPER, ['a name']],
      ]);

      // a dataset without the headword says so with an empty group
      const one = await read(ONE);
      expect(one.meta).toEqual({ word: ONE, datasets: 2, found: 1 });
      expect(one.data.map((group) => [group.dataset, group.word, group.count, group.entries.length])).toEqual([
        ['default', ONE, 0, 0],
        [NAME, ONE, 1, 1],
      ]);
      await request(server()).get(`/api/v1/words/${HEADWORD}nowhere/datasets`).expect(404);
      // the routes of the served dataset did not learn of the other one
      await request(server()).get(`/api/v1/words/${ONE}`).expect(404);

      // the history behind `modified` is read from the dataset it was written in
      const changed = await request(server()).get(`/api/v1/words/${BOTH}/datasets/${NAME}/history`).expect(200);
      expect(changed.body.meta).toEqual({ word: BOTH, count: 1, variants: [PROPER] });
      expect(changed.body.data).toEqual([
        expect.objectContaining({
          word: BOTH,
          source: 'princeton-wordnet',
          diff: { description: { before: 'said before', after: 'what the source says' } },
        }),
      ]);
      const clean = await request(server()).get(`/api/v1/words/${BOTH}/datasets/default/history`).expect(200);
      expect(clean.body.data).toEqual([]);
      await request(server()).get(`/api/v1/words/${ONE}/datasets/default/history`).expect(404);
      await request(server()).get(`/api/v1/words/${BOTH}/datasets/${IMPORTED}/history`).expect(404);

      expect((await reader(NAME)).driver).toBe(dataSource.driver);
      await Promise.all(Array.from({ length: 12 }, () => read(BOTH)));

      // after a switch the groups are the same, the served one is another
      const before = await request(server()).get(`/api/v1/words/${BOTH}/datasets`).expect(200);
      await request(server()).post(`/api/en/datasets/${NAME}/activate`).set(auth).expect(200);
      const after = await request(server()).get(`/api/v1/words/${BOTH}/datasets`).expect(200);
      const switched = after.body as PublicWordDatasetsV1ResT;
      expect(switched.data.map((group) => [group.dataset, group.active])).toEqual([
        ['default', false],
        [NAME, true],
      ]);
      expect(switched.data.map((group) => group.entries)).toEqual(data.map((group) => group.entries));
      expect(after.headers.etag).not.toBe(before.headers.etag);
      expect(Date.parse(after.headers['last-modified'] as string)).toBeGreaterThanOrEqual(
        Date.parse(before.headers['last-modified'] as string),
      );
    } finally {
      await request(server()).post('/api/en/datasets/default/activate').set(auth).expect(200);
      await (await reader(NAME)).query(`DELETE FROM "en_changes" WHERE "headword" LIKE $1`, [`${HEADWORD}%`]);
      for (const dataset of ['default', NAME]) {
        await (
          await reader(dataset)
        ).query(`DELETE FROM "en_words" WHERE lower("word") LIKE $1`, [`${HEADWORD}%`]);
        await (
          await reader(dataset)
        ).query(`DELETE FROM "en_entries" WHERE lower("word") LIKE $1`, [`${HEADWORD}%`]);
      }
    }
  });

  it('switches under load: no request meets the closed connection', async () => {
    const reads = Array.from({ length: 40 }, () => request(server()).get('/api/v1/meta'));
    const switches = (async () => {
      await request(server()).post(`/api/en/datasets/${NAME}/activate`).set(auth).expect(200);
      await request(server()).post('/api/en/datasets/default/activate').set(auth).expect(200);
    })();
    const later = Array.from({ length: 40 }, () => request(server()).get('/api/v1/meta'));

    const answers = await Promise.all([...reads, ...later]);
    await switches;

    expect(answers.map((answer) => answer.status).filter((status) => status !== 200)).toEqual([]);
    // an answer names the dataset it was taken from, whichever side of the switch it fell on
    for (const answer of answers) expect(['default', NAME]).toContain(answer.body.data.dataset);
    expect((await list()).active).toBe('default');
  });

  it('counts a switch as a change: Last-Modified does not go back in time', async () => {
    const onDefault = await request(server()).get('/api/v1/meta').expect(200);
    await request(server()).post(`/api/en/datasets/${NAME}/activate`).set(auth).expect(200);
    const onOther = await request(server()).get('/api/v1/meta').expect(200);
    await request(server()).post('/api/en/datasets/default/activate').set(auth).expect(200);

    const earlier = Date.parse(onDefault.headers['last-modified'] ?? new Date(0).toUTCString());
    expect(Date.parse(onOther.headers['last-modified'] as string)).toBeGreaterThanOrEqual(earlier);
    expect(onOther.headers.etag).not.toBe(onDefault.headers.etag);
  });

  it('starts on the active dataset, with shared migrations applied', async () => {
    await request(server()).post(`/api/en/datasets/${NAME}/activate`).set(auth).expect(200);
    try {
      await expect(prepareDatabase()).resolves.toBeUndefined();
    } finally {
      await request(server()).post('/api/en/datasets/default/activate').set(auth).expect(200);
    }
    await expect(prepareDatabase()).resolves.toBeUndefined();
  });

  it('imports into a dataset that is not the active one: a schema of its own, the active dataset untouched', async () => {
    const other = IMPORTED;
    const word = `${HEADWORD}imp`;
    const line =
      JSON.stringify({
        word,
        part_of_speech: 'noun',
        area_variant: '',
        generated_by_model: '',
        generated: false,
        verb___phrasal_object_pattern: '',
        verb___transitivity: '',
        language_register: '',
        categories: [],
        verb___is_phrasal: false,
        verb___is_irregular: false,
        noun___is_proper: false,
        word_level: '',
        description: 'imported into a dataset of its own',
        transcription: '',
        is_obsolete: false,
        version: '1.0.0',
        is_abbreviation: false,
        noun___uncountable: false,
        noun___irregular_plural: false,
        noun___always_plural: false,
        base_phrasal: '',
        phrasal_variants: [],
        forms: [],
        short_translations: [],
        meanings: [],
      }) + '\n';
    // an export of a WordNet dataset of another instance, its terms typed over by hand
    const manifest = {
      version: '2026.09',
      files: { 'vocab-bloom-hub-en-words.jsonl': { lines: 1 } },
      source: 'wordnet',
      license: 'CC0-1.0',
      attribution: 'Somebody else',
      notice: 'Not what the catalog says',
    };
    const before = await (await reader('default')).query(`SELECT count(*)::int AS n FROM "en_words"`);
    const versionBefore = await dataSource.query(
      `SELECT "value" FROM "public"."settings" WHERE "field" = 'en_dataset_version'`,
    );

    try {
      const res = await request(server())
        .post('/api/en/dictionary/import/upload')
        .set(auth)
        .field('dataset', other)
        .attach('words', Buffer.from(line), 'words.jsonl')
        .attach('manifest', Buffer.from(JSON.stringify(manifest)), 'manifest.json')
        .expect(201);
      expect(res.text).toContain('"datasetVersion":"2026.09"');

      // the import installed the dataset under the terms of the catalog, filled it and left the active one alone
      const { active, datasets } = await list();
      expect(active).toBe('default');
      expect(datasets.find((dataset) => dataset.name === other)).toEqual(
        expect.objectContaining({
          installed: true,
          source: 'wordnet',
          license: 'CC-BY-4.0',
          license_url: 'https://creativecommons.org/licenses/by/4.0/',
          attribution: expect.stringContaining('Open English WordNet'),
          attribution_url: 'https://en-word.net',
          notice: null,
          version: '2026.09',
          active: false,
        }),
      );
      expect(await (await reader(other)).query(`SELECT "word" FROM "en_entries"`)).toEqual([{ word }]);
      expect(await (await reader('default')).query(`SELECT count(*)::int AS n FROM "en_words"`)).toEqual(
        before,
      );
      await request(server()).get(`/api/v1/words/${word}`).expect(404);
      // the version the settings mirror is the active dataset's, not the imported one's
      expect(
        await dataSource.query(`SELECT "value" FROM "public"."settings" WHERE "field" = 'en_dataset_version'`),
      ).toEqual(versionBefore);

      expect((await list()).datasets.find((dataset) => dataset.name === other)?.is_public).toBe(false);
      await request(server())
        .patch(`/api/en/datasets/${other}/visibility`)
        .set(auth)
        .send({ is_public: true })
        .expect(200);
      // served once it is the active one
      await request(server()).post(`/api/en/datasets/${other}/activate`).set(auth).expect(200);
      const found = await request(server()).get(`/api/v1/words/${word}`).expect(200);
      expect(found.body.data[0]).toEqual(expect.objectContaining({ word, source: 'wordnet' }));
      // every answer that carries the entry names the source, the search and the parts of the entry too
      const flat = await request(server()).get(`/api/v1/search?search=${word}`).expect(200);
      expect(flat.body.data[0]).toEqual(expect.objectContaining({ word, source: 'wordnet', modified: false }));
      const forms = await request(server()).get(`/api/v1/words/${word}/forms`).expect(200);
      const meanings = await request(server()).get(`/api/v1/words/${word}/meanings`).expect(200);
      for (const part of [...forms.body.data, ...meanings.body.data] as Array<{ source: string }>) {
        expect(part.source).toBe('wordnet');
      }
      // …under its own terms
      const meta = await request(server()).get('/api/v1/meta').expect(200);
      expect(meta.body.data).toEqual(
        expect.objectContaining({
          dataset: other,
          source: 'wordnet',
          license: 'CC-BY-4.0',
          license_url: 'https://creativecommons.org/licenses/by/4.0/',
          attribution: expect.stringContaining('Open English WordNet'),
          notice: '',
          dataset_version: '2026.09',
        }),
      );

      // data of another source does not go into it
      const mixed = await request(server())
        .post('/api/en/dictionary/import/upload')
        .set(auth)
        .field('dataset', other)
        .attach('words', Buffer.from(line), 'words.jsonl')
        .attach('manifest', Buffer.from(JSON.stringify({ ...manifest, source: 'wiktionary' })), 'manifest.json')
        .expect(409);
      expect(mixed.body.message).toBe('dataset_source_mismatch');
    } finally {
      await request(server()).post('/api/en/datasets/default/activate').set(auth);
      await request(server()).delete(`/api/en/datasets/${other}`).set(auth);
    }
  });

  it('never deletes the active dataset or the default one; deleting drops the schema', async () => {
    const isDefault = await request(server()).delete('/api/en/datasets/default').set(auth).expect(409);
    expect(isDefault.body.message).toBe('dataset_is_default');

    await request(server()).post(`/api/en/datasets/${NAME}/activate`).set(auth).expect(200);
    const isActive = await request(server()).delete(`/api/en/datasets/${NAME}`).set(auth).expect(409);
    expect(isActive.body.message).toBe('dataset_is_active');
    await request(server()).post('/api/en/datasets/default/activate').set(auth).expect(200);

    // a read of every dataset opened a connection on the one that is about to go (issue #528)
    const STAYS = `${HEADWORD}stays`;
    await (await reader('default')).query(`INSERT INTO "en_entries" ("word") VALUES ($1)`, [STAYS]);
    await (
      await reader('default')
    ).query(
      `INSERT INTO "en_words" ("word", "part_of_speech", "form_of_word", "generated")
       VALUES ($1, 'noun', 'base_form', false)`,
      [STAYS],
    );
    try {
      const both = await request(server()).get(`/api/v1/words/${STAYS}/datasets`).expect(200);
      expect(both.body.meta).toEqual({ word: STAYS, datasets: 2, found: 1 });

      await request(server()).delete(`/api/en/datasets/${NAME}`).set(auth).expect(200);
      expect(
        await dataSource.query(`SELECT count(*)::int AS n FROM pg_namespace WHERE nspname = $1`, [
          `ds_${NAME}`,
        ]),
      ).toEqual([{ n: 0 }]);
      // the connection went with the dataset
      // what is read from every dataset changed, although no row of the remaining one did
      const one = await request(server()).get(`/api/v1/words/${STAYS}/datasets`).expect(200);
      expect(one.body.meta).toEqual({ word: STAYS, datasets: 1, found: 1 });
      expect(one.headers.etag).not.toBe(both.headers.etag);
      expect(Date.parse(one.headers['last-modified'] as string)).toBeGreaterThanOrEqual(
        Date.parse(both.headers['last-modified'] as string),
      );
    } finally {
      await (await reader('default')).query(`DELETE FROM "en_words" WHERE "word" = $1`, [STAYS]);
      await (await reader('default')).query(`DELETE FROM "en_entries" WHERE "word" = $1`, [STAYS]);
    }
    // the catalog still offers it
    expect((await list()).datasets.find((dataset) => dataset.name === NAME)).toEqual(
      expect.objectContaining({ installed: false, version: null, created_at: null }),
    );
    await request(server()).post(`/api/en/datasets/${NAME}/activate`).set(auth).expect(404);
  });
});
