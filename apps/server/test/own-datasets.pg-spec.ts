import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import * as yauzl from 'yauzl';

import { AppModule } from '../src/modules/AppModule/app.module';
import { createJwt } from '../core/utils/auth';
import { hashLoginString } from '../core/utils/crypto';
import {
  DatasetManifestT,
  DatasetT,
  DatasetsListT,
  EnAreaVariantsE,
  EnPartOfSpeechE,
  EnWordFormsE,
  PublicWordDatasetsV1ResT,
} from '../types';

/**
 * The datasets of the instance's own (issue #540) on Postgres: created
 * empty under the license the owner chose, public before they are active,
 * their license changed and journaled. The suite never writes to the
 * default dataset; it creates its datasets, works in them and removes them,
 * and refuses to start on an instance that holds one of their names.
 */
const MINE = 'pgspec_mine';
const HOUSE = 'pgspec_house';
const HEADWORD = `zzpgown${Date.now().toString(36)}`;
const HOUSE_TEXT = 'Whoever reads these words may read them aloud, and nothing else.';
// a word written through the switch of the admin UI into a dataset that is not served
const EDITED = `${HEADWORD}ed`;

/** One file of an archive, as text */
const fileOfZip = (zip: Buffer, name: string): Promise<string> =>
  new Promise((resolve, reject) => {
    yauzl.fromBuffer(zip, { lazyEntries: true }, (error, archive) => {
      if (error || !archive) return reject(error ?? new Error('no archive'));
      archive.on('entry', (entry: yauzl.Entry) => {
        if (entry.fileName !== name) return archive.readEntry();
        archive.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) return reject(streamError ?? new Error('no stream'));
          const parts: Buffer[] = [];
          stream.on('data', (part: Buffer) => parts.push(part));
          stream.on('end', () => resolve(Buffer.concat(parts).toString('utf-8')));
        });
      });
      archive.on('end', () => reject(new Error(`${name} is not in the archive`)));
      archive.readEntry();
    });
  });

describe('datasets of the instance’s own (Postgres, issue #540)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const auth = { Authorization: '' };
  const server = () => app.getHttpServer();
  // set once the suite knows the datasets it removes are its own
  let owned = false;

  const list = async (): Promise<DatasetsListT> =>
    (await request(server()).get('/api/en/datasets').set(auth).expect(200)).body as DatasetsListT;

  // the import slot is let go a moment after the last chunk of the stream
  const released = async (): Promise<void> => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const status = await request(server()).get('/api/en/dictionary/import/status').set(auth);
      if (!status.body.running) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('the import slot was not released');
  };

  const rateLimit = process.env.PUBLIC_API_RATE_LIMIT;

  beforeAll(async () => {
    process.env.PUBLIC_API_RATE_LIMIT = '100000/60';
    const username = process.env.ADMIN_USERNAME as string;
    const password = process.env.ADMIN_PASSWORD as string;
    const hashByEnv = await hashLoginString(username, password);
    const secretHash = await hashLoginString(username, hashByEnv);
    auth.Authorization = `Bearer ${createJwt({ role: 'admin' }, secretHash + hashByEnv)}`;

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    dataSource = app.get(DataSource);

    const held = (await list()).datasets.filter((dataset) => [MINE, HOUSE].includes(dataset.name));
    if (held.length) {
      await app.close();
      throw new Error(
        `The database holds the dataset(s) ${held.map((dataset) => dataset.name).join(', ')}: ` +
          'this suite creates and deletes them. Run it against a database without them.',
      );
    }
    owned = true;
  });

  afterAll(async () => {
    if (rateLimit === undefined) delete process.env.PUBLIC_API_RATE_LIMIT;
    else process.env.PUBLIC_API_RATE_LIMIT = rateLimit;
    if (!owned) return;
    await request(server()).post('/api/en/datasets/default/activate').set(auth);
    for (const name of [MINE, HOUSE]) {
      await request(server()).delete(`/api/en/datasets/${name}`).set(auth);
      await dataSource.query(`DROP SCHEMA IF EXISTS "ds_${name}" CASCADE`);
    }
    await app.close();
  });

  it('creates an empty dataset under a license of the list: a schema of its own, public before it is active', async () => {
    const res = await request(server())
      .post('/api/en/datasets')
      .set(auth)
      .send({
        name: MINE,
        title: 'My words',
        license: { spdx: 'CC-BY-SA-4.0' },
        attribution: 'The words of the owner of this instance',
        attribution_url: 'https://example.org/words',
      })
      .expect(201);
    expect(res.body as DatasetT).toEqual(
      expect.objectContaining({
        name: MINE,
        title: 'My words',
        own: true,
        installed: true,
        source: MINE,
        license: 'CC-BY-SA-4.0',
        license_text: null,
        active: false,
      }),
    );

    // the registry marks it the owner's: the catalog of a later version does not take it for its own
    expect(
      await dataSource.query(`SELECT "name", "own" FROM "public"."datasets" WHERE "name" IN ('default', $1)`, [
        MINE,
      ]),
    ).toEqual(
      expect.arrayContaining([
        { name: 'default', own: false },
        { name: MINE, own: true },
      ]),
    );

    const tables = (await dataSource.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY 1`,
      [`ds_${MINE}`],
    )) as Array<{ table_name: string }>;
    expect(tables.map((row) => row.table_name)).toEqual(
      expect.arrayContaining(['en_entries', 'en_words', 'en_changes', 'suggestions', 'dataset_migrations']),
    );

    // twice is refused; a name of the catalog is not taken
    const again = await request(server())
      .post('/api/en/datasets')
      .set(auth)
      .send({ name: MINE, title: 'Again', license: { spdx: 'CC0-1.0' }, attribution: 'Me' })
      .expect(409);
    expect(again.body.message).toBe('dataset_already_exists');
    for (const name of ['wiktionary', 'wordnet', 'default']) {
      const reserved = await request(server())
        .post('/api/en/datasets')
        .set(auth)
        .send({ name, title: 'Mine', license: { spdx: 'CC0-1.0' }, attribution: 'Me' })
        .expect(409);
      expect(reserved.body.message).toBe('dataset_name_reserved');
    }

    // an installed dataset is public before it is activated (issue #528), under the terms its owner stated
    await dataSource.query(`INSERT INTO "ds_${MINE}"."en_entries" ("word") VALUES ($1)`, [HEADWORD]);
    await dataSource.query(
      `INSERT INTO "ds_${MINE}"."en_words" ("word", "part_of_speech", "form_of_word", "description", "generated")
       VALUES ($1, 'noun', 'base_form', 'a word of the owner', false)`,
      [HEADWORD],
    );
    const { data } = (await request(server()).get(`/api/v1/words/${HEADWORD}/datasets`).expect(200))
      .body as PublicWordDatasetsV1ResT;
    const group = data.find((item) => item.dataset === MINE);
    expect(group).toEqual(
      expect.objectContaining({
        title: 'My words',
        active: false,
        source: MINE,
        license: 'CC-BY-SA-4.0',
        license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
        attribution: 'The words of the owner of this instance',
        attribution_url: 'https://example.org/words',
        license_text: '',
        count: 1,
      }),
    );
    expect(group?.entries.map((entry) => [entry.source, entry.description])).toEqual([
      [MINE, 'a word of the owner'],
    ]);
    // the datasets of the catalog carry their titles too
    expect(data.find((item) => item.dataset === 'default')?.title).toBe('Vocab Bloom Hub English dataset');
  });

  it('creates a dataset under a license of the owner’s own and serves its text, in the groups and in /meta', async () => {
    await request(server())
      .post('/api/en/datasets')
      .set(auth)
      .send({
        name: HOUSE,
        title: 'House rules',
        license: { name: 'House License 1.0', url: 'https://example.org/license', text: HOUSE_TEXT },
        attribution: 'The house',
      })
      .expect(201);

    const { data } = (await request(server()).get(`/api/v1/words/${HEADWORD}/datasets`).expect(200))
      .body as PublicWordDatasetsV1ResT;
    expect(data.find((item) => item.dataset === HOUSE)).toEqual(
      expect.objectContaining({
        title: 'House rules',
        license: 'House License 1.0',
        license_url: 'https://example.org/license',
        license_text: HOUSE_TEXT,
        attribution_url: null,
        count: 0,
      }),
    );

    await request(server()).post(`/api/en/datasets/${HOUSE}/activate`).set(auth).expect(200);
    try {
      const meta = (await request(server()).get('/api/v1/meta').expect(200)).body.data;
      expect(meta).toEqual(
        expect.objectContaining({
          dataset: HOUSE,
          title: 'House rules',
          source: HOUSE,
          license: 'House License 1.0',
          license_text: HOUSE_TEXT,
          notice: '',
        }),
      );
      // the active dataset is not deleted, its own or not
      const refused = await request(server()).delete(`/api/en/datasets/${HOUSE}`).set(auth).expect(409);
      expect(refused.body.message).toBe('dataset_is_active');
    } finally {
      await request(server()).post('/api/en/datasets/default/activate').set(auth).expect(200);
    }
  });

  it('changes the license of a dataset of the owner’s and journals the license before and after', async () => {
    const res = await request(server())
      .patch(`/api/en/datasets/${MINE}`)
      .set(auth)
      .send({ license: { spdx: 'CC-BY-4.0' }, title: 'My own words' })
      .expect(200);
    expect(res.body).toEqual(expect.objectContaining({ license: 'CC-BY-4.0', title: 'My own words' }));

    const journal = await request(server()).get('/api/en/audit?entity_type=dataset').set(auth).expect(200);
    const change = journal.body.items.find(
      (row: { headword: string; action: string }) => row.headword === MINE && row.action === 'update',
    );
    expect(change.diff).toEqual(
      expect.objectContaining({
        license: { before: 'CC-BY-SA-4.0', after: 'CC-BY-4.0' },
        title: { before: 'My words', after: 'My own words' },
      }),
    );

    // …and nothing about a dataset of the catalog
    const fixed = await request(server())
      .patch('/api/en/datasets/default')
      .set(auth)
      .send({ license: { spdx: 'CC0-1.0' } })
      .expect(409);
    expect(fixed.body.message).toBe('dataset_terms_fixed');
  });

  // Part 2 of issue #540: the admin routes of the dictionary work on the dataset a request names
  it('edits a dataset that is not served: a word added, edited and deleted in it, the active one untouched', async () => {
    const inMine = { dataset: MINE };
    const activeWords = await dataSource.query(`SELECT count(*)::int AS n FROM "public"."en_words"`);
    const lastModifiedOf = async () =>
      new Date(
        (await request(server()).get(`/api/v1/words/${HEADWORD}/datasets`).expect(200)).headers[
          'last-modified'
        ] as string,
      ).getTime();
    const before = await lastModifiedOf();
    // the header has a resolution of a second
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const added = await request(server())
      .post('/api/en/add/word')
      .query(inMine)
      .set(auth)
      .send({
        word: EDITED,
        part_of_speech: EnPartOfSpeechE.noun,
        form_of_word: EnWordFormsE.base_form,
        // a dataset of the owner's takes what a model generated (issue #540)
        generated: true,
        forms: [],
        meanings: [
          {
            title: 'a word of the owner',
            definition: 'a word written into a dataset that is not served',
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
    const id = (added.body as { id: number }).id;

    // written where it was asked, and nowhere else
    expect(
      await dataSource.query(`SELECT count(*)::int AS n FROM "ds_${MINE}"."en_words" WHERE "word" = $1`, [
        EDITED,
      ]),
    ).toEqual([{ n: 1 }]);
    expect(await dataSource.query(`SELECT count(*)::int AS n FROM "public"."en_words"`)).toEqual(activeWords);
    expect((await list()).active).toBe('default');
    await request(server()).get(`/api/v1/words/${EDITED}`).expect(404);
    // …and public on the tab of its dataset, the reads of every dataset changed with it
    const { data } = (await request(server()).get(`/api/v1/words/${EDITED}/datasets`).expect(200))
      .body as PublicWordDatasetsV1ResT;
    expect(data.find((group) => group.dataset === MINE)?.count).toBe(1);
    expect(data.find((group) => group.dataset === 'default')?.count).toBe(0);
    expect(await lastModifiedOf()).toBeGreaterThan(before);

    // the reads of the admin UI answer from the dataset they name
    const check = await request(server())
      .get(`/api/en/check-word/${EDITED}`)
      .query({ partOfSpeech: 'noun', ...inMine })
      .set(auth)
      .expect(200);
    expect(check.body).toEqual({ hasWord: true, id });
    const elsewhere = await request(server())
      .get(`/api/en/check-word/${EDITED}`)
      .query({ partOfSpeech: 'noun' })
      .set(auth)
      .expect(200);
    expect(elsewhere.body.hasWord).toBe(false);
    const found = await request(server())
      .get('/api/en/search')
      .query({ search: EDITED, ...inMine })
      .set(auth);
    expect(found.body.map((item: { word: string }) => item.word)).toEqual([EDITED]);
    // a word found in a dataset that is not served names that dataset as its source
    expect(found.body.map((item: { source: string }) => item.source)).toEqual([MINE]);
    const notFound = await request(server()).get('/api/en/search').query({ search: EDITED }).set(auth);
    expect(notFound.body).toEqual([]);
    const statistics = await request(server()).get('/api/en/statistics').query(inMine).set(auth).expect(200);
    expect(statistics.body.totals.entries).toBeGreaterThanOrEqual(2);

    await request(server())
      .patch(`/api/en/common-info/${id}`)
      .query(inMine)
      .set(auth)
      .send({ description: 'corrected in its own dataset' })
      .expect(200);
    const read = await request(server()).get(`/api/en/${id}`).query(inMine).set(auth).expect(200);
    expect(read.body.description).toBe('corrected in its own dataset');

    // the history of edits is the one of the dataset
    const history = await request(server())
      .get('/api/en/changes')
      .query({ headword: EDITED, ...inMine })
      .set(auth);
    expect(history.body.items.map((change: { action: string }) => change.action).sort()).toEqual([
      'create',
      'update',
    ]);
    const activeHistory = await request(server()).get('/api/en/changes').query({ headword: EDITED }).set(auth);
    expect(activeHistory.body.items).toEqual([]);

    // …and so is the queue of suggestions
    await dataSource.query(`INSERT INTO "ds_${MINE}"."suggestions" ("headword", "message") VALUES ($1, $2)`, [
      EDITED,
      'a report on a word of the owner',
    ]);
    const queue = await request(server()).get('/api/en/suggestions').query(inMine).set(auth).expect(200);
    expect(queue.body.items.map((item: { headword: string }) => item.headword)).toEqual([EDITED]);
    const activeQueue = await request(server()).get('/api/en/suggestions').set(auth).expect(200);
    expect(activeQueue.body.items.map((item: { headword: string }) => item.headword)).not.toContain(EDITED);

    await request(server()).delete(`/api/en/${id}`).query(inMine).set(auth).expect(200);
    expect(
      await dataSource.query(`SELECT count(*)::int AS n FROM "ds_${MINE}"."en_words" WHERE "word" = $1`, [
        EDITED,
      ]),
    ).toEqual([{ n: 0 }]);
    expect(await dataSource.query(`SELECT count(*)::int AS n FROM "public"."en_words"`)).toEqual(activeWords);
  });

  it('exports a dataset of the owner’s under its terms and takes the copy back; another dataset refuses it', async () => {
    const exported = await request(server())
      .get('/api/en/dictionary/export')
      .query({ dataset: MINE })
      .set(auth);
    const { exportId } = JSON.parse(exported.text.trim().split('\n').at(-1) as string) as { exportId: string };
    const archive = await request(server())
      .get(`/api/en/dictionary/export/download/${exportId}`)
      .set(auth)
      .buffer(true)
      .parse((res, done) => {
        const parts: Buffer[] = [];
        res.on('data', (part: Buffer) => parts.push(part));
        res.on('end', () => done(null, Buffer.concat(parts)));
      })
      .expect(200);
    const zip = archive.body as Buffer;

    const manifest = JSON.parse(await fileOfZip(zip, 'manifest.json')) as DatasetManifestT;
    expect(manifest).toEqual(
      expect.objectContaining({
        source: MINE,
        // a dataset of the owner's without a version has none: not the version of the code
        version: '',
        license: 'CC-BY-4.0',
        attribution: 'The words of the owner of this instance',
        attribution_url: 'https://example.org/words',
      }),
    );
    const license = await fileOfZip(zip, 'LICENSE');
    expect(license).toContain('My own words\nSource: https://example.org/words\n');
    expect(license).toContain('(CC-BY-4.0)');

    // a copy of the dataset goes back into it…
    const back = await request(server())
      .post('/api/en/dictionary/import/upload')
      .set(auth)
      .field('dataset', MINE)
      .attach('archive', zip, 'export.zip')
      .expect(201);
    expect(back.text).toContain('"stage":5');
    expect(
      await dataSource.query(`SELECT count(*)::int AS n FROM "ds_${MINE}"."en_words" WHERE "word" = $1`, [
        HEADWORD,
      ]),
    ).toEqual([{ n: 1 }]);
    await released();

    // …and into no other: another dataset holds data of another source
    const refused = await request(server())
      .post('/api/en/dictionary/import/upload')
      .set(auth)
      .field('dataset', HOUSE)
      .attach('archive', zip, 'export.zip');
    expect(refused.text).toContain('dataset_source_mismatch');
    await released();

    // …nor into itself under another license: data is not relicensed by an import
    await request(server())
      .patch(`/api/en/datasets/${MINE}`)
      .set(auth)
      .send({ license: { spdx: 'CC0-1.0' } })
      .expect(200);
    const relicensed = await request(server())
      .post('/api/en/dictionary/import/upload')
      .set(auth)
      .field('dataset', MINE)
      .attach('archive', zip, 'export.zip');
    expect(relicensed.text).toContain('dataset_source_mismatch');
  });

  it('deletes a dataset of the owner’s with its schema', async () => {
    await request(server()).delete(`/api/en/datasets/${HOUSE}`).set(auth).expect(200);
    expect((await list()).datasets.map((dataset) => dataset.name)).not.toContain(HOUSE);
    expect(
      await dataSource.query(
        `SELECT count(*)::int AS n FROM information_schema.schemata WHERE schema_name = $1`,
        [`ds_${HOUSE}`],
      ),
    ).toEqual([{ n: 0 }]);
  });
});
