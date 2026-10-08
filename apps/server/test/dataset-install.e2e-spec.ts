import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { gzipSync } from 'node:zlib';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/modules/AppModule/app.module';
import { checkIsPostgres } from '../configuration';
import { findCatalogEntry } from '../core/constants/dataset_catalog';
import { filesOf, writeTarGz, writeZip } from '../src/converters/__tests__/pack';
import {
  openGlossFixtureRows,
  openGlossInflectionFixtureRows,
  writeOpenGlossFixture,
} from '../src/converters/__tests__/opengloss-fixture';
import { DatasetsService } from '../src/modules/DatasetsModule/datasets.service';
import { EnWord } from '../src/modules/EnModule/entities/en_word.entity';
import { createJwt } from '../core/utils/auth';
import { hashLoginString } from '../core/utils/crypto';
import { DatasetsListT, ImportDictionaryChunkT, EnWordT, EnWordFormsE, ForkProgressT } from '../types';

const E2E_USERNAME = 'e2e-admin';
const E2E_PASSWORD = 'e2e-password';
const FIXTURES = path.join(__dirname, '../src/converters/__tests__/fixtures');
// EnDictionaryImportPhasesE.converting_source / completed
const CONVERTING = 13;
const COMPLETED = 5;

/**
 * A dataset of the catalog installed from the file of its source (issue
 * #527): the admin attaches what the source distributes, the server converts
 * and imports it into a schema of its own, and the instance serves it under
 * the terms the catalog states. The suite runs on both drivers: SQLite has
 * no schemas and refuses, Postgres does the work.
 */
describe('installing a dataset from its source (e2e, issue #527)', () => {
  let app: INestApplication<App>;
  let dir: string;
  const auth = { Authorization: '' };
  const server = () => app.getHttpServer();
  const supported = checkIsPostgres();
  const sources: Record<
    'wiktionary' | 'wiktionaryNewer' | 'wiktionaryUndated' | 'wordnet' | 'princeton' | 'cmudict',
    string
  > = {
    wiktionary: '',
    wiktionaryNewer: '',
    wiktionaryUndated: '',
    wordnet: '',
    princeton: '',
    cmudict: path.join(FIXTURES, 'cmudict.dict'),
  };

  const chunksOf = (text: string): ImportDictionaryChunkT[] =>
    text
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ImportDictionaryChunkT);

  const list = async (): Promise<DatasetsListT> =>
    (await request(server()).get('/api/en/datasets').set(auth).expect(200)).body as DatasetsListT;

  const datasetOf = async (name: string) => (await list()).datasets.find((dataset) => dataset.name === name);

  const install = (name: string, file: string, pronunciations?: string) => {
    const req = request(server()).post(`/api/en/datasets/${name}/install`).set(auth).attach('file', file);
    return pronunciations ? req.attach('pronunciations', pronunciations) : req;
  };

  // what follows the last chunk of the stream (the import slot) lands a moment later
  const released = async (): Promise<void> => {
    for (let attempt = 1; attempt <= 40; attempt += 1) {
      const status = await request(server()).get('/api/en/dictionary/import/status').set(auth).expect(200);
      if (!status.body.running) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('the import slot was not released');
  };

  beforeAll(async () => {
    process.env.ADMIN_USERNAME = E2E_USERNAME;
    process.env.ADMIN_PASSWORD = E2E_PASSWORD;
    const hashByEnv = await hashLoginString(E2E_USERNAME, E2E_PASSWORD);
    const secretHash = await hashLoginString(E2E_USERNAME, hashByEnv);
    auth.Authorization = `Bearer ${createJwt({ role: 'admin' }, secretHash + hashByEnv)}`;

    // the fixtures as their sources pack them, under names that say nothing: an upload has none
    dir = await mkdtemp(path.join(os.tmpdir(), 'vocab-bloom-e2e-sources-'));
    // the extract says when it was made in the header of its gzip (issue #530);
    // packed again by a tool that writes no date, it does not
    const extract = await readFile(path.join(FIXTURES, 'kaikki.jsonl'));
    const madeAt = (day: string): Buffer => {
      const packed = gzipSync(extract);
      packed.writeUInt32LE(Math.floor(Date.parse(day) / 1000), 4);
      return packed;
    };
    sources.wiktionary = path.join(dir, 'a');
    await writeFile(sources.wiktionary, madeAt('2026-09-25T10:02:34Z'));
    sources.wiktionaryNewer = path.join(dir, 'a2');
    await writeFile(sources.wiktionaryNewer, madeAt('2026-09-27T08:00:00Z'));
    sources.wiktionaryUndated = path.join(dir, 'a3');
    await writeFile(sources.wiktionaryUndated, gzipSync(extract));
    sources.wordnet = await writeZip(
      path.join(dir, 'b'),
      await filesOf(path.join(FIXTURES, 'wordnet'), 'oewn2025/'),
    );
    sources.princeton = await writeTarGz(
      path.join(dir, 'c'),
      [
        ...(await filesOf(path.join(FIXTURES, 'wordnet'), 'dict/')),
        // the build log a release of Princeton is versioned by
        { name: 'dict/log.grind.3.1', content: Buffer.from('grind\n') },
      ],
      ['dict/'],
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('is an admin route', async () => {
    // The guard can answer before a file stream finishes writing (EPIPE).
    // Buffer this small fixture so the test checks the 401 response reliably.
    await request(server()).post('/api/en/datasets/wordnet/install/download').send({}).expect(401);
    await request(server())
      .post('/api/en/datasets/wordnet/install')
      .attach('file', await readFile(sources.wordnet), 'wordnet.zip')
      .expect(401);
  });

  it('refuses what is not a dataset of a source', async () => {
    const unknown = await install('nope', sources.wordnet).expect(404);
    expect(unknown.body.message).toBe('dataset_not_found');
    // the project's own dataset comes through the import page
    const own = await install('default', sources.wordnet).expect(400);
    expect(own.body.message).toBe('dataset_not_installable');
  });

  if (!supported) {
    it('has no schemas on SQLite: 409 datasets_not_supported, and the upload is not kept', async () => {
      await request(server()).post('/api/en/datasets/wordnet/install/download').set(auth).send({}).expect(409);
      const res = await install('wordnet', sources.wordnet, sources.cmudict).expect(409);
      expect(res.body.message).toBe('datasets_not_supported');
      expect(await datasetOf('wordnet')).toEqual(expect.objectContaining({ installed: false }));
    });
    return;
  }

  it('asks for the file, and for the file of this source', async () => {
    const none = await request(server()).post('/api/en/datasets/wordnet/install').set(auth).expect(400);
    expect(none.body.message).toBe('dataset_upload_missing');

    for (const [name, file, pronunciations] of [
      ['wiktionary', sources.wordnet],
      ['wiktionary', sources.cmudict],
      ['wordnet', sources.wiktionary],
      ['wordnet', sources.cmudict],
      ['wordnet_princeton', sources.cmudict],
      ['wordnet', sources.wordnet, sources.wordnet],
    ] as Array<[string, string, string?]>) {
      const res = await install(name, file, pronunciations).expect(400);
      expect({ name, message: res.body.message }).toEqual({ name, message: 'dataset_source_invalid' });
    }

    // nothing was created for a file that was refused, nothing of it is left on the disk
    expect((await list()).datasets.filter((dataset) => dataset.installed).map((d) => d.name)).toEqual([
      'default',
    ]);
    const kept = await readdir(path.join(os.tmpdir(), 'vocab-bloom-import', 'sources')).catch(() => []);
    expect(kept).toEqual([]);
    await released();
  });

  it('installs Wiktionary from its extract while the default dataset keeps serving', async () => {
    const res = await install('wiktionary', sources.wiktionary).expect(201);
    const chunks = chunksOf(res.text);

    // the conversion first, then the import of what it wrote
    expect(chunks[0]).toEqual({ percent: 0, stage: CONVERTING });
    expect(chunks.filter((chunk) => chunk.stage === CONVERTING).at(-1)?.percent).toBe(100);
    expect(chunks.at(-1)).toEqual(
      // the version is the day the extract was made, not the day it was installed (issue #530)
      expect.objectContaining({ percent: 100, stage: COMPLETED, datasetVersion: '2026.09.25' }),
    );
    // a first install adds, it has nothing to update
    expect(chunks.at(-1)).not.toHaveProperty('updated_entries');
    await released();

    expect(await datasetOf('wiktionary')).toEqual(
      expect.objectContaining({
        installed: true,
        active: false,
        source: 'wiktionary',
        license: 'CC-BY-SA-4.0',
        version: '2026.09.25',
        imported_at: expect.any(String),
      }),
    );
    expect((await list()).active).toBe('default');
    await request(server()).get('/api/v1/words/lamp').expect(404);
    const meta = await request(server()).get('/api/v1/meta').expect(200);
    expect(meta.body.data).toEqual(
      expect.objectContaining({ dataset: 'default', source: 'vocab-bloom-hub', license: 'CC-BY-4.0' }),
    );
  });

  it('serves it under the terms of Wiktionary once it is activated', async () => {
    await request(server()).post('/api/en/datasets/wiktionary/activate').set(auth).expect(200);

    // the version of the file is what the instance reports, here and in the read of every dataset
    const served = await request(server()).get('/api/v1/meta').expect(200);
    expect(served.body.data).toEqual(
      expect.objectContaining({ dataset: 'wiktionary', dataset_version: '2026.09.25' }),
    );
    const groups = await request(server()).get('/api/v1/words/lamp/datasets').expect(200);
    expect(
      groups.body.data.map((group: { dataset: string; dataset_version: string | null }) => [
        group.dataset,
        group.dataset_version,
      ]),
    ).toContainEqual(['wiktionary', '2026.09.25']);

    const lamp = await request(server()).get('/api/v1/words/lamp').expect(200);
    expect(lamp.body.meta).toEqual({ word: 'lamp', count: 3, variants: [] });
    const noun = lamp.body.data.find((entry: { part_of_speech: string }) => entry.part_of_speech === 'noun');
    expect(noun).toEqual(
      expect.objectContaining({
        source: 'wiktionary',
        transcription: '/lɛəmp/',
        // nothing says how formal the word is: no register, not a default one
        language_register: null,
        word_level: null,
      }),
    );
    expect(noun.forms.map((form: { word: string }) => form.word)).toEqual(['lamps']);
    expect(noun.meanings[0].quotes).toEqual([
      {
        text: 'An invented quotation. '.repeat(30),
        reference: 'Test Author, Invented Book (2026), chapter 2, p. 19',
      },
      { text: 'A second invented quotation.', reference: null },
    ]);
    expect(noun.meanings.map((meaning: { title: string }) => meaning.title)).toEqual([
      'A device that gives light',
      'A source of spiritual light',
      'A heavy blow',
      'A device that gives light',
    ]);
    // Equal definitions in distinct source etymologies must survive installation.
    expect(noun.etymologies).toEqual([
      { number: 1, text: '' },
      { number: 2, text: '' },
    ]);
    expect(noun.meanings.map((meaning: { etymology_number: number }) => meaning.etymology_number)).toEqual([
      1, 1, 2, 2,
    ]);
    expect(
      noun.meanings[0].translations.map((t: { language: string; title: string }) => [t.language, t.title]),
    ).toEqual(
      expect.arrayContaining([
        ['ru', 'лампа'],
        ['zh', '灯'],
        ['de', 'Lampe'],
        ['es', 'lámpara'],
      ]),
    );

    // the inflected form finds its entry; the phrasal verb knows its base verb
    const lamps = await request(server()).get('/api/v1/words/lamps').expect(200);
    expect(lamps.body.data[0].word).toBe('lamp');
    const takeOff = await request(server()).get('/api/v1/words/take%20off').expect(200);
    expect(takeOff.body.data[0]).toEqual(
      expect.objectContaining({ verb___is_phrasal: true, base_phrasal: 'take' }),
    );
    const phrase = await request(server()).get('/api/v1/words/better%20late%20than%20never').expect(200);
    expect(phrase.body.data[0].part_of_speech).toBe('phrase');

    const meta = await request(server()).get('/api/v1/meta').expect(200);
    expect(meta.body.data).toEqual(
      expect.objectContaining({
        dataset: 'wiktionary',
        source: 'wiktionary',
        license: 'CC-BY-SA-4.0',
        license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
        attribution: expect.stringContaining('Wiktionary contributors'),
        attribution_url: 'https://en.wiktionary.org',
        notice: '',
        // a Creative Commons license is named by its link
        license_text: '',
      }),
    );
  });

  it('updates an installed dataset from a newer file: the entries are replaced, not doubled', async () => {
    const before = (await request(server()).get('/api/v1/meta').expect(200)).body.data.counts;

    const res = await install('wiktionary', sources.wiktionaryNewer).expect(201);
    const last = chunksOf(res.text).at(-1);
    await released();

    expect(last).toEqual(
      expect.objectContaining({
        stage: COMPLETED,
        added_entries: 0,
        kept_user_modified: 0,
        // the newer file says its own day
        datasetVersion: '2026.09.27',
      }),
    );
    expect(await datasetOf('wiktionary')).toEqual(expect.objectContaining({ version: '2026.09.27' }));
    const meta = await request(server()).get('/api/v1/meta').expect(200);
    expect(meta.body.data.dataset_version).toBe('2026.09.27');
    expect(last?.updated_entries).toBeGreaterThan(0);
    const lamp = await request(server()).get('/api/v1/words/lamp').expect(200);
    expect(lamp.body.meta).toEqual({ word: 'lamp', count: 3, variants: [] });
    // the counts of /meta are cached for a minute: the rows are what is compared
    expect(before.entries).toBeGreaterThan(0);
  });

  it('records the day of the installation for a file that does not say when it was made (issue #530)', async () => {
    const res = await install('wiktionary', sources.wiktionaryUndated).expect(201);
    await released();

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10).replace(/-/g, '.');
    // the suite may run over midnight
    expect([today, yesterday]).toContain(chunksOf(res.text).at(-1)?.datasetVersion);
    expect([today, yesterday]).toContain((await datasetOf('wiktionary'))?.version);
  });

  it('installs both editions of WordNet, each into its own dataset, from a zip and from a tar.gz', async () => {
    const open = await install('wordnet', sources.wordnet, sources.cmudict).expect(201);
    // the edition of the release; the pronunciations have no version and are not a part of it (issue #530)
    expect(chunksOf(open.text).at(-1)).toEqual(
      expect.objectContaining({ stage: COMPLETED, datasetVersion: '2025' }),
    );
    await released();
    const princeton = await install('wordnet_princeton', sources.princeton).expect(201);
    expect(chunksOf(princeton.text).at(-1)).toEqual(
      expect.objectContaining({ stage: COMPLETED, datasetVersion: '3.1' }),
    );
    await released();
    expect((await list()).datasets.map((dataset) => [dataset.name, dataset.version])).toEqual(
      expect.arrayContaining([
        ['wordnet', '2025'],
        ['wordnet_princeton', '3.1'],
      ]),
    );

    expect(
      (await list()).datasets.map((dataset) => [dataset.name, dataset.installed, dataset.license]),
    ).toEqual([
      ['default', true, 'CC-BY-4.0'],
      ['wiktionary', true, 'CC-BY-SA-4.0'],
      ['wordnet', true, 'CC-BY-4.0'],
      ['wordnet_princeton', true, 'WordNet'],
      ['opengloss', false, 'CC-BY-4.0'],
    ]);

    await request(server()).post('/api/en/datasets/wordnet/activate').set(auth).expect(200);
    const run = await request(server()).get('/api/v1/words/run').expect(200);
    expect(run.body.data[0]).toEqual(
      expect.objectContaining({
        source: 'wordnet',
        part_of_speech: 'verb',
        transcription: '/ɹʌn/',
        verb___is_irregular: true,
      }),
    );
    expect(run.body.data[0].meanings[0]).toEqual(
      expect.objectContaining({ synonyms: ['sprint'], antonyms: ['walk'], language_register: 'slang' }),
    );
    const good = await request(server()).get('/api/v1/words/good/forms').expect(200);
    expect(good.body.data.map((form: { word: string }) => form.word).sort()).toEqual(['best', 'better']);
    // Wiktionary is not in here: the phrase is an entry of the other dataset
    await request(server()).get('/api/v1/words/better%20late%20than%20never').expect(404);

    // the same release without the pronunciations: the entries, no transcription
    await request(server()).post('/api/en/datasets/wordnet_princeton/activate').set(auth).expect(200);
    const plain = await request(server()).get('/api/v1/words/run').expect(200);
    expect(plain.body.data[0]).toEqual(
      expect.objectContaining({ source: 'princeton-wordnet', transcription: '' }),
    );
    const meta = await request(server()).get('/api/v1/meta').expect(200);
    expect(meta.body.data).toEqual(
      expect.objectContaining({
        dataset: 'wordnet_princeton',
        dataset_version: '3.1',
        license: 'WordNet',
        attribution: expect.stringContaining('Princeton University'),
      }),
    );
    // the WordNet license wants its notice on every copy of the data: the API carries it in full (issue #531)
    expect(meta.body.data.license_text).toContain(
      'WordNet 3.1 Copyright 2011 by Princeton University.  All rights reserved.',
    );
    expect(meta.body.data.license_text).toContain('Carnegie Mellon University');
  });

  // issue #531: a dataset of a public source says nothing about generated text, so it holds none
  it('takes a word the owner wrote into a dataset of a source, and nothing a model generated', async () => {
    await request(server()).post('/api/en/datasets/wiktionary/activate').set(auth).expect(200);
    const word = (generated: boolean) => ({
      word: 'lantern',
      part_of_speech: 'noun',
      form_of_word: 'base_form',
      generated,
      forms: [],
      meanings: [],
      short_translations: [],
    });

    const refused = await request(server()).post('/api/en/add/word').set(auth).send(word(true)).expect(400);
    expect(refused.body.message).toBe('generated_not_allowed');
    await request(server()).get('/api/v1/words/lantern').expect(404);

    const added = await request(server()).post('/api/en/add/word').set(auth).send(word(false)).expect(201);
    const served = await request(server()).get('/api/v1/words/lantern').expect(200);
    // the word is the owner's, in a dataset of Wiktionary: the reader is told
    expect(served.body.data[0]).toEqual(expect.objectContaining({ source: 'wiktionary', modified: true }));
    const marked = await request(server())
      .patch(`/api/en/common-info/${added.body.id}`)
      .set(auth)
      .send({ generated: true })
      .expect(400);
    expect(marked.body.message).toBe('generated_not_allowed');

    // …and an import of generated lines stops before it writes them
    const line = JSON.stringify({ ...word(true), word: 'candle', description: 'generated', version: '1' });
    const imported = await request(server())
      .post('/api/en/dictionary/import/upload')
      .set(auth)
      .attach('words', Buffer.from(`${line}\n`), 'words.jsonl');
    expect(chunksOf(imported.text).some((chunk) => chunk.stage === COMPLETED)).toBe(false);
    await released();
    await request(server()).get('/api/v1/words/candle').expect(404);

    // the dataset of the project is what models generated, and says so
    await request(server()).post('/api/en/datasets/default/activate').set(auth).expect(200);
    await request(server()).post('/api/en/add/word').set(auth).send(word(true)).expect(201);
    const own = await request(server()).get('/api/v1/words/lantern').expect(200);
    expect(own.body.data[0]).toEqual(expect.objectContaining({ source: 'vocab-bloom-hub', modified: true }));
  });

  it('keeps the datasets apart: the file of one source does not go into the dataset of another', async () => {
    // an export of the active dataset names its source; as an import into `default` it is refused
    await request(server()).post('/api/en/datasets/default/activate').set(auth).expect(200);
    const manifest = {
      version: '1',
      source: 'wiktionary',
      files: { 'vocab-bloom-hub-en-words.jsonl': { lines: 0 } },
    };
    const refused = await request(server())
      .post('/api/en/dictionary/import/upload')
      .set(auth)
      .attach('words', Buffer.from(''), 'words.jsonl')
      .attach('manifest', Buffer.from(JSON.stringify(manifest)), 'manifest.json')
      .expect(409);
    expect(refused.body.message).toBe('dataset_source_mismatch');
    await released();

    const journal = await request(server()).get('/api/en/audit?entity_type=dataset').set(auth).expect(200);
    const created = journal.body.items.filter((row: { action: string }) => row.action === 'create');
    expect(created.map((row: { headword: string }) => row.headword).sort()).toEqual([
      'wiktionary',
      'wordnet',
      'wordnet_princeton',
    ]);
  });

  // issue #530: the sources are asked about what the instance holds, and the answer is compared
  // with the versions the files were installed with. The sources are never called from the suite
  it('tells when the source of an installed dataset has a newer file', async () => {
    const realFetch = global.fetch;
    const flag = process.env.UPDATE_CHECK;
    delete process.env.UPDATE_CHECK;
    const asked: string[] = [];
    // what the catalog tells to ask, and nothing else: the address is compared as a whole
    const wiktionary = findCatalogEntry('wiktionary')?.update_check;
    const wordnet = findCatalogEntry('wordnet')?.update_check;
    const extractUrl = wiktionary?.kind === 'last_modified' ? wiktionary.url : '';
    const releasesUrl = wordnet?.kind === 'latest_release' ? wordnet.api_url : '';
    // an extract made in six weeks from now, the edition of the next year
    const inSixWeeks = new Date(Date.now() + 42 * 86_400_000);
    global.fetch = (async (url: string) => {
      asked.push(String(url));
      if (String(url) === releasesUrl) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ tag_name: '2026-edition', html_url: 'https://x.example/r' }),
        };
      }
      if (String(url) === extractUrl) {
        return { ok: true, status: 200, headers: new Headers({ 'last-modified': inSixWeeks.toUTCString() }) };
      }
      throw new Error(`the suite asks nothing of ${String(url)}`);
    }) as unknown as typeof fetch;

    try {
      const res = await request(server()).get('/api/en/datasets/updates').set(auth).expect(200);
      expect(res.body.enabled).toBe(true);
      expect(
        res.body.datasets.map(
          (dataset: { name: string; installed: string; latest: string; update_available: boolean }) => [
            dataset.name,
            dataset.installed,
            dataset.latest,
            dataset.update_available,
          ],
        ),
      ).toEqual([
        [
          'wiktionary',
          (await datasetOf('wiktionary'))?.version,
          inSixWeeks.toISOString().slice(0, 10).replace(/-/g, '.'),
          true,
        ],
        ['wordnet', '2025', '2026', true],
      ]);
      // Princeton WordNet is frozen and the project's dataset is checked on the import page: two sources, two requests
      expect([...asked].sort()).toEqual([releasesUrl, extractUrl].sort());
    } finally {
      global.fetch = realFetch;
      if (flag === undefined) delete process.env.UPDATE_CHECK;
      else process.env.UPDATE_CHECK = flag;
    }
  });

  it('installs OpenGloss with exact word licenses, then preserves them through a fork, edits and export/import', async () => {
    const rows = openGlossFixtureRows();
    const inflections = openGlossInflectionFixtureRows();
    rows.lexicon.push(...inflections.lexicon);
    rows.senses.push(...inflections.senses);
    // The same form belongs to two differently licensed bases, one with zero inflection.
    rows.lexicon[0].morphology[0].plural = 'glimmer';
    rows.lexicon[2].morphology[0].plural = 'glimmer';
    const files = await writeOpenGlossFixture(path.join(dir, 'opengloss'), rows);
    const missing = await install('opengloss', files.file).expect(400);
    expect(missing.body.message).toBe('dataset_upload_missing');
    const wrong = request(server()).post('/api/en/datasets/opengloss/install').set(auth);
    for (const [field, file] of Object.entries(files))
      wrong.attach(field, field === 'lexicon' ? files.file : file);
    expect((await wrong.expect(400)).body.message).toBe('dataset_source_invalid');
    expect((await datasetOf('opengloss'))?.installed).toBe(false);

    const req = request(server()).post('/api/en/datasets/opengloss/install').set(auth);
    for (const [field, file] of Object.entries(files)) req.attach(field, file);
    const installed = await req.expect(201);
    expect(chunksOf(installed.text).at(-1)).toMatchObject({ stage: COMPLETED, percent: 100 });
    await released();
    const version = (await datasetOf('opengloss'))?.version;
    expect(version).not.toBe('2.4'); // authored fixtures cannot impersonate the verified upstream release
    const read = async (dataset: string, word: string): Promise<EnWordT> => {
      const search = await request(server())
        .get('/api/en/search')
        .query({ dataset, search: word })
        .set(auth)
        .expect(200);
      return (
        await request(server()).get(`/api/en/${search.body[0].id}`).query({ dataset }).set(auth).expect(200)
      ).body as EnWordT;
    };
    const original = await read('opengloss', 'glimmer');
    const derived = await read('opengloss', 'Northstar');
    expect(original.licenses?.map((license) => license.spdx)).toEqual(['CC-BY-4.0']);
    expect(derived.licenses?.map((license) => license.spdx)).toEqual(['CC-BY-4.0', 'WordNet']);
    expect(derived.origins?.map((origin) => origin.version)).toEqual([version, '3.0']);
    expect(derived.generated).toBe(true);
    expect(derived.generated_by_model).toBe('fixture-model');
    expect(original.meanings[0].synonyms).toEqual(['Northstar']);
    const publicOriginal = await request(server()).get('/api/v1/words/glimmer/datasets').expect(200);
    expect(publicOriginal.text).toContain('"synonyms":["Northstar"]');
    // The fix is stored in the dataset, not hidden by the public projection.
    const datasets = app.get(DatasetsService);
    const dataset = (await datasets.installed()).find((item) => item.name === 'opengloss')!;
    const connection = await datasets.reader(dataset);
    const ran = await connection
      .getRepository(EnWord)
      .createQueryBuilder('w')
      .innerJoin('w.word', 'entry')
      .leftJoinAndSelect('w.base_form', 'base')
      .leftJoinAndSelect('base.word', 'baseEntry')
      .where('entry.word = :word', { word: 'ran' })
      .getMany();
    expect(ran).toHaveLength(1);
    expect(ran[0]).toMatchObject({
      form_of_word: EnWordFormsE.past_simple,
      base_form: { word: { word: 'run' } },
    });
    const run = await request(server()).get('/api/v1/words/run/datasets').expect(200);
    const runGroup = run.body.data.find((group: { dataset: string }) => group.dataset === 'opengloss');
    expect(
      runGroup.entries.map((entry: { word: string; part_of_speech: string }) => [
        entry.word,
        entry.part_of_speech,
      ]),
    ).toEqual([
      ['run', 'noun'],
      ['run', 'verb'],
    ]);
    expect(runGroup.entries[1].meanings).toHaveLength(4);
    const past = await request(server()).get('/api/v1/words/ran/datasets').expect(200);
    expect(past.body.data.find((group: { dataset: string }) => group.dataset === 'opengloss').entries).toEqual([
      runGroup.entries[1],
    ]);
    const readForm = async (dataset: string, base: EnWordT) => {
      const form = base.forms.find((form) => form.form_of_word === EnWordFormsE.plural_form)!;
      expect(form.word).toBe('glimmer');
      const loaded = (
        await request(server()).get(`/api/en/${form.id}`).query({ dataset }).set(auth).expect(200)
      ).body as EnWordT;
      expect(loaded.licenses).toEqual(base.licenses);
      return loaded;
    };
    expect((await readForm('opengloss', original)).origins).toEqual(original.origins);
    expect((await readForm('opengloss', derived)).origins).toEqual(derived.origins);
    await request(server())
      .patch(`/api/en/common-info/${derived.id}`)
      .query({ dataset: 'opengloss' })
      .set(auth)
      .send({ generated: true })
      .expect(200);

    await request(server())
      .post('/api/en/datasets/opengloss/fork')
      .set(auth)
      .send({
        name: 'open_fork',
        title: 'Edited glossary',
        version: '1',
        license: { spdx: 'ODbL-1.0' },
        attribution: 'Test editors',
      })
      .expect(202);
    let state: ForkProgressT | undefined;
    for (let attempt = 0; attempt < 200; attempt++) {
      state = (await request(server()).get('/api/en/datasets/open_fork/fork-status').set(auth).expect(200))
        .body as ForkProgressT;
      if (state.state !== 'copying') break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(state?.state).toBe('completed');
    const forked = await read('open_fork', 'Northstar');
    const forkedOriginal = await read('open_fork', 'glimmer');
    expect(forked.licenses?.map((license) => license.spdx)).toEqual(['CC-BY-4.0', 'WordNet']);
    expect(forked.contributions ?? []).toEqual([]);
    await request(server())
      .patch(`/api/en/common-info/${forked.id}`)
      .query({ dataset: 'open_fork' })
      .set(auth)
      .send({ description: 'An edited description of this test vehicle.' })
      .expect(200);
    const changed = await read('open_fork', 'Northstar');
    expect(changed.licenses?.map((license) => license.spdx)).toEqual(['CC-BY-4.0', 'WordNet', 'ODbL-1.0']);
    const groups = await request(server()).get('/api/v1/words/Northstar/datasets').expect(200);
    expect(groups.text).toContain('WordNet 3.0 Copyright 2006');

    const exported = await request(server())
      .get('/api/en/dictionary/export')
      .query({ dataset: 'open_fork' })
      .set(auth)
      .expect(200);
    const { exportId } = JSON.parse(exported.text.trim().split('\n').at(-1)!) as { exportId: string };
    const archive = await request(server())
      .get(`/api/en/dictionary/export/download/${exportId}`)
      .set(auth)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    await request(server()).delete('/api/en/datasets/open_fork').set(auth).expect(200);
    await request(server())
      .post('/api/en/datasets')
      .set(auth)
      .send({
        name: 'open_fork',
        title: 'Restored glossary',
        license: { spdx: 'ODbL-1.0' },
        attribution: 'Test editors',
      })
      .expect(201);
    const restored = await request(server())
      .post('/api/en/dictionary/import/upload')
      .set(auth)
      .field('dataset', 'open_fork')
      .attach('archive', archive.body as Buffer, 'dataset.zip')
      .expect(201);
    expect(chunksOf(restored.text).at(-1)).toMatchObject({ stage: COMPLETED });
    await released();
    const word = await read('open_fork', 'Northstar');
    expect(word.origins).toEqual(changed.origins);
    expect(word.licenses).toEqual(changed.licenses);
    const restoredOriginal = await read('open_fork', 'glimmer');
    expect(restoredOriginal.meanings[0].synonyms).toEqual(['Northstar']);
    expect(restoredOriginal.origins).toEqual(forkedOriginal.origins);
    expect((await readForm('open_fork', word)).origins).toEqual(word.origins);
    expect((await readForm('open_fork', restoredOriginal)).origins).toEqual(restoredOriginal.origins);
  });
  describe('downloading source files on the server', () => {
    const endpoint = (name: string) =>
      request(server()).post(`/api/en/datasets/${name}/install/download`).set(auth);
    const noTemporarySources = async () => {
      const files = await readdir(path.join(os.tmpdir(), 'vocab-bloom-import'));
      expect(files.filter((file) => file.startsWith('source-download-'))).toEqual([]);
    };

    it('rejects arbitrary URLs, invalid options and non-convertible datasets before any download', async () => {
      const fetchMock = jest.spyOn(global, 'fetch');
      try {
        await endpoint('opengloss').send({ url: 'http://localhost/private' }).expect(400);
        await endpoint('opengloss').send({ pronunciations: 'yes' }).expect(400);
        await endpoint('opengloss').send({ pronunciations: true }).expect(400);
        await endpoint('default').send({}).expect(400);
        await endpoint('unknown').send({}).expect(404);
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        fetchMock.mockRestore();
      }
    });

    it('downloads all six catalog URLs, keeps the import slot until completion, and retains word licenses', async () => {
      await request(server()).delete('/api/en/datasets/opengloss').set(auth).expect(200);
      const fixture = await writeOpenGlossFixture(path.join(dir, 'download-opengloss'));
      const entry = findCatalogEntry('opengloss')!;
      if (entry.install.kind !== 'convert') throw new Error('Expected a converter');
      const files = entry.install.files;
      let releaseDownload: () => void = () => {};
      let entered: () => void = () => {};
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const hold = new Promise<void>((resolve) => {
        releaseDownload = resolve;
      });
      const asked: string[] = [];
      const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
        const file = files.find((file) => file.url === String(url));
        if (!file) throw new Error(`Unexpected URL: ${String(url)}`);
        asked.push(String(url));
        if (asked.length === 1) {
          entered();
          await hold;
        }
        const buffer = await readFile(fixture[file.field as keyof typeof fixture]);
        return new Response(new Uint8Array(buffer), { headers: { 'content-length': String(buffer.length) } });
      });
      const installing = endpoint('opengloss')
        .send({})
        .expect(201)
        .then((res) => res);
      try {
        await started;
        const status = await request(server()).get('/api/en/dictionary/import/status').set(auth).expect(200);
        expect(status.body).toMatchObject({ running: true, stage: 4, dataset: 'opengloss' });
        expect((await endpoint('wordnet').send({}).expect(409)).body.message).toBe('import_in_progress');
        expect(asked).toHaveLength(1);
        releaseDownload();
        const res = await installing;
        const chunks = chunksOf(res.text);
        expect(chunks.filter((chunk) => chunk.stage === 4).at(-1)?.percent).toBe(100);
        expect(chunks.some((chunk) => chunk.stage === CONVERTING)).toBe(true);
        expect(chunks.at(-1)).toMatchObject({ stage: COMPLETED });
        expect(asked).toEqual(files.map((file) => file.url));
        await released();
        const groups = await request(server()).get('/api/v1/words/Northstar/datasets').expect(200);
        const group = groups.body.data.find((group: { dataset: string }) => group.dataset === 'opengloss');
        expect(JSON.stringify(group)).toContain('WordNet 3.0 Copyright 2006');
        await noTemporarySources();
      } finally {
        releaseDownload();
        await installing;
        fetchMock.mockRestore();
      }
    });

    it('cleans up failed downloads, releases the slot and allows a retry without optional files', async () => {
      const entry = findCatalogEntry('wordnet')!;
      if (entry.install.kind !== 'convert') throw new Error('Expected a converter');
      const files = entry.install.files;
      const archive = new Uint8Array(await readFile(sources.wordnet));
      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockImplementation(async (url) =>
          String(url) === files[0].url ? new Response(archive) : new Response('not found', { status: 404 }),
        );
      try {
        const failed = await endpoint('wordnet').send({ pronunciations: true }).expect(201);
        expect(chunksOf(failed.text).some((chunk) => chunk.stage === COMPLETED)).toBe(false);
        await released();
        await noTemporarySources();
        const status = await request(server()).get('/api/en/dictionary/import/status').set(auth).expect(200);
        expect(status.body.error).toContain('404');
        expect(fetchMock).toHaveBeenCalledTimes(2);
        fetchMock.mockClear();
        const retried = await endpoint('wordnet').send({}).expect(201);
        expect(chunksOf(retried.text).at(-1)).toMatchObject({
          stage: COMPLETED,
          updated_entries: expect.any(Number),
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await released();
        await noTemporarySources();
      } finally {
        fetchMock.mockRestore();
      }
    });
  });
});
