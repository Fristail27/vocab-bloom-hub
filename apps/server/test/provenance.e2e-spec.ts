import type { AdminPronunciationT } from '../types';
import { AuditService } from '../src/modules/AuditModule/audit.service';
import { DatasetsService } from '../src/modules/DatasetsModule/datasets.service';
import { runDatasetMigrations } from '../src/db/datasets';
import { DataSource } from 'typeorm';
import { DATASET_FILE_NAMES } from '../src/modules/EnModule/modules/EnImportDictionary/constants';
import { portableManifest } from '../src/modules/EnModule/modules/EnImportDictionary/utils/parseManifest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/modules/AppModule/app.module';
import { checkIsPostgres } from '../configuration';
import { createJwt } from '../core/utils/auth';
import { hashLoginString } from '../core/utils/crypto';
import type { EnWordT, OriginT, ForkProgressT, ChangeT } from '../types';
import { EnPartOfSpeechE } from '../types';

describe('word provenance and independent forks (#556)', () => {
  let app: INestApplication<App>;
  const auth = { Authorization: '' };
  const api = () => request(app.getHttpServer());
  const pg = checkIsPostgres() ? it : it.skip;
  let cedar: EnWordT;
  const recording = (url: string) => ({
    url,
    source_url: 'https://example.org/speaker',
    attribution: 'Invented speaker',
    licenses: [{ spdx: 'CC0-1.0', name: 'CC0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' }],
    sort_order: 0,
  });
  const portablePronunciations = (values: AdminPronunciationT[] | undefined) =>
    values?.map(({ id: _id, audio, ...value }) => ({
      ...value,
      ...(audio?.length && { audio: audio.map(({ id: _audioId, ...recording }) => recording) }),
    }));
  const manual: OriginT = {
    id: 'manual-source-v2',
    name: 'Example glossary',
    version: '2',
    url: 'https://example.org/glossary',
    licenses: [{ spdx: 'CC-BY-4.0', name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' }],
    license_relation: 'all',
    attribution: 'Example editors',
    notices: ['Preserve this attribution.'],
    method: 'manual',
    scope: 'word',
    inherited: false,
    recorded_at: '2026-10-02T12:00:00.000Z',
  };
  const create = (name: string, license = 'CC-BY-4.0') =>
    api()
      .post('/api/en/datasets')
      .set(auth)
      .send({ name, title: name, license: { spdx: license }, attribution: 'Local editors' })
      .expect(201);
  const read = async (dataset: string, id: number): Promise<EnWordT> =>
    (await api().get(`/api/en/${id}`).query({ dataset }).set(auth).expect(200)).body as EnWordT;
  const payload = (value: EnWordT) => {
    const { licenses: _licenses, contributions: _contributions, user_modified: _modified, ...body } = value;
    return body;
  };
  const fork = async (parent: string, name: string): Promise<void> => {
    await api()
      .post(`/api/en/datasets/${parent}/fork`)
      .set(auth)
      .send({ name, title: name, license: { spdx: 'CC-BY-4.0' }, attribution: 'Local editors' })
      .expect(202);
    for (let attempt = 0; attempt < 200; attempt++) {
      const progress = (await api().get(`/api/en/datasets/${name}/fork-status`).set(auth).expect(200))
        .body as ForkProgressT;
      if (progress.state === 'completed') return;
      if (progress.state === 'failed') throw new Error(progress.failure);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error('fork did not complete');
  };

  beforeAll(async () => {
    process.env.ADMIN_USERNAME = 'e2e-admin';
    process.env.ADMIN_PASSWORD = 'e2e-password';
    const hash = await hashLoginString('e2e-admin', 'e2e-password');
    auth.Authorization = `Bearer ${createJwt({ role: 'admin' }, (await hashLoginString('e2e-admin', hash)) + hash)}`;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    const line = {
      word: 'cedar',
      part_of_speech: 'noun',
      version: 'source-1',
      generated: false,
      description: 'a tree',
      pronunciations: [
        {
          type: 'ipa',
          text: '/seed-er/',
          area_variant: 'american',
          sort_order: 0,
          audio: [recording('https://example.org/cedar.ogg')],
        },
      ],
      etymologies: [{ number: 1, text: 'Invented origin for the transfer fixture.' }],
      forms: [
        {
          word: 'cedars',
          form_of_word: 'plural_form',
          area_variant: 'common',
          transcription: '/legacy-seeders/',
          pronunciations: [
            {
              type: 'ipa',
              text: null,
              area_variant: 'british',
              sort_order: 0,
              audio: [recording('https://example.org/cedars.ogg')],
            },
          ],
          alternatives: ['cedarr'],
        },
      ],
      meanings: [
        {
          etymology_number: 1,
          quotes: [
            {
              text: 'An invented quotation. '.repeat(30),
              reference: 'Test Author, Book, p. 1',
              source_url: 'https://example.org/book',
            },
            { text: 'Another invented quotation.', reference: null },
          ],
          title: 'tree',
          definition: 'An evergreen tree.',
          sort_order: 0,
          examples: [],
          categories: [],
          is_obsolete: false,
          area_variant: 'common',
          translations: [{ language: 'ru', title: 'кедр', definition: 'Дерево.', variants_of_words: [] }],
        },
      ],
      short_translations: [],
    };
    await api()
      .post('/api/en/dictionary/import/upload')
      .set(auth)
      .attach(
        'words',
        Buffer.from(
          [
            JSON.stringify({ ...line, alternatives: ['cedarr'] }),
            JSON.stringify({ ...line, word: 'cedarr', forms: [], meanings: [], alternatives: ['cedar'] }),
          ].join('\n') + '\n',
        ),
        'words.jsonl',
      )
      .expect(201);
    const publicRead = await api().get('/api/v1/words/cedar').expect(200);
    cedar = await read('default', publicRead.body.data[0].id as number);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('snapshots default terms and inherits them on partial reads and forms without inventing history', async () => {
    expect(cedar.origins).toEqual([
      expect.objectContaining({ name: 'Vocab Bloom Hub English dataset', inherited: true }),
    ]);
    const meanings = await api().get('/api/v1/words/cedar/meanings').expect(200);
    expect(meanings.body.data[0].origins).toEqual(cedar.origins);
    expect(meanings.body.data[0].licenses[0].spdx).toBe('CC-BY-4.0');
    expect(meanings.body.data[0].etymology_number).toBe(1);
    expect(meanings.body.data[0].quotes).toEqual(cedar.meanings[0].quotes);
    const full = await api().get('/api/v1/words/cedar').expect(200);
    expect(full.body.data[0].etymologies).toEqual([
      { number: 1, text: 'Invented origin for the transfer fixture.' },
    ]);
    expect(full.body.data[0].pronunciations[0].audio[0].licenses).toEqual(recording('').licenses);
    expect(full.body.data[0].pronunciations[0].audio[0]).not.toHaveProperty('id');
    expect(full.body.data[0].forms[0].pronunciations[0].text).toBeNull();
    expect((await read('default', cedar.forms[0].id)).origins).toEqual(cedar.origins);
    const history = await api().get('/api/en/changes').query({ headword: 'cedar' }).set(auth).expect(200);
    expect(history.body.items).toHaveLength(0);
  });

  it('keeps multiple versions of a manually declared source, records corrections, and protects inherited terms', async () => {
    const origins = [...cedar.origins!, manual, { ...manual, id: 'manual-source-v3', version: '3' }];
    await api()
      .patch(`/api/en/${cedar.id}/origins`)
      .set(auth)
      .send({ origins, reason: 'Manually transferred examples.' })
      .expect(200);
    const saved = await read('default', cedar.id);
    expect(saved.licenses).toHaveLength(3);
    expect(saved.origins!.map((origin) => origin.version)).toEqual([null, '2', '3']);
    await api()
      .patch(`/api/en/${cedar.id}/origins`)
      .set(auth)
      .send({ origins: [manual], reason: 'Remove original.' })
      .expect(409);
    await api()
      .patch(`/api/en/${cedar.id}/origins`)
      .set(auth)
      .send({ origins: [{ ...manual, licenses: [] }], reason: 'No terms.' })
      .expect(400);
    const history = await api().get('/api/en/changes').query({ headword: 'cedar' }).set(auth).expect(200);
    const change = history.body.items[0] as ChangeT;
    expect(change.reason).toBe('Manually transferred examples.');
    expect(change.diff.origins.before).toEqual(cedar.origins);
    await api().post(`/api/en/changes/${change.id}/revert`).set(auth).expect(200);
    expect((await read('default', cedar.id)).origins).toEqual(cedar.origins);
    await api()
      .patch('/api/en/word/meaning')
      .set(auth)
      .send({ id: cedar.meanings[0].id, quotes: [] })
      .expect(200);
    const quoteHistory = await api().get('/api/en/changes').query({ headword: 'cedar' }).set(auth).expect(200);
    const quoteChange = quoteHistory.body.items[0] as ChangeT;
    expect(quoteChange.diff.quotes.before).toEqual(cedar.meanings[0].quotes);
    await api().post(`/api/en/changes/${quoteChange.id}/revert`).set(auth).expect(200);
    expect((await read('default', cedar.id)).meanings[0].quotes).toEqual(cedar.meanings[0].quotes);
    const sounds = cedar.pronunciations!.map((value) => ({ ...value, audio: [] }));
    await api().patch(`/api/en/common-info/${cedar.id}`).set(auth).send({ pronunciations: sounds }).expect(200);
    const audioHistory = await api().get('/api/en/changes').query({ headword: 'cedar' }).set(auth).expect(200);
    const audioChange = audioHistory.body.items[0] as ChangeT;
    expect(audioChange.diff.pronunciations.before).toEqual(portablePronunciations(cedar.pronunciations));
    await api().post(`/api/en/changes/${audioChange.id}/revert`).set(auth).expect(200);
    const restored = await read('default', cedar.id);
    expect(portablePronunciations(restored.pronunciations)).toEqual(
      portablePronunciations(cedar.pronunciations),
    );
    cedar = restored;
  });

  pg('copies a word into an inactive own dataset, preserving content and inherited history', async () => {
    await create('copied_words');
    const unrelated = await api()
      .post('/api/en/add/word')
      .query({ dataset: 'copied_words' })
      .set(auth)
      .send({
        word: 'unrelated',
        etymologies: [{ number: 1, text: 'An unrelated origin.' }],
        part_of_speech: 'noun',
        form_of_word: 'base_form',
        area_variant: 'common',
        forms: [],
        short_translations: [],
        meanings: [
          {
            title: 'local meaning',
            definition: 'Keep me',
            sort_order: 0,
            examples: [],
            area_variant: 'common',
            is_obsolete: false,
            translations: [
              { language: 'ru', title: 'местное', definition: 'Не менять', variants_of_words: [] },
            ],
          },
        ],
      })
      .expect(201);
    const unrelatedBefore = await read('copied_words', unrelated.body.id as number);
    await api()
      .post('/api/en/add/word')
      .query({ dataset: 'copied_words' })
      .set(auth)
      .send({
        word: 'cedarr',
        part_of_speech: 'noun',
        form_of_word: 'base_form',
        area_variant: 'common',
        generated: false,
      })
      .expect(201);
    const preview = (await api().get(`/api/en/copy-preview/default/${cedar.id}`).set(auth).expect(200))
      .body as EnWordT;
    const saved = await api()
      .post('/api/en/add/word')
      .query({ dataset: 'copied_words' })
      .set(auth)
      .send(payload(preview))
      .expect(201);
    const copy = await read('copied_words', saved.body.id as number);
    expect(copy.meanings[0].definition).toBe('An evergreen tree.');
    expect(copy.meanings[0].translations[0].title).toBe('кедр');
    expect(copy.meanings[0].translations[0].id).not.toBe(unrelatedBefore.meanings[0].translations[0].id);
    expect(await read('copied_words', unrelated.body.id as number)).toEqual(unrelatedBefore);
    expect(copy.forms[0].word).toBe('cedars');
    expect(copy.forms[0].alternatives).toEqual(['cedarr']);
    expect(copy.alternatives).toEqual(['cedarr']);
    expect(copy.etymologies).toEqual([
      { id: expect.any(Number), number: 1, text: 'Invented origin for the transfer fixture.' },
    ]);
    expect(portablePronunciations(copy.pronunciations)).toEqual(portablePronunciations(cedar.pronunciations));
    expect(portablePronunciations(copy.forms[0].pronunciations)).toEqual(
      portablePronunciations(cedar.forms[0].pronunciations),
    );
    expect(copy.forms[0].transcription).toBe('/legacy-seeders/');
    expect(copy.meanings[0].etymology_number).toBe(1);
    expect(copy.meanings[0].quotes).toEqual(cedar.meanings[0].quotes);
    expect(copy.etymologies![0].id).not.toBe(cedar.etymologies![0].id);
    expect(copy.origins).toHaveLength(1);
    expect(copy.origins![0]).toMatchObject({
      ...cedar.origins![0],
      acquisitions: [{ method: 'copy', recorded_at: expect.any(String), revision: expect.any(String) }],
    });
    expect(copy.licenses).toEqual(cedar.licenses);
    expect((await read('copied_words', copy.forms[0].id)).origins).toEqual(copy.origins);
    const history = await api()
      .get('/api/en/changes')
      .query({ dataset: 'copied_words', headword: 'cedar' })
      .set(auth)
      .expect(200);
    expect(history.body.items.length).toBeGreaterThan(0);
    expect(
      (history.body.items as ChangeT[]).every((change) => change.inherited_from && !change.revertible),
    ).toBe(true);
    expect((history.body.items as ChangeT[])[0].inherited_from).toEqual(copy.origins![0]);
    await api()
      .patch(`/api/en/${copy.id}/origins`)
      .query({ dataset: 'copied_words' })
      .set(auth)
      .send({ origins: [{ ...copy.origins![0], acquisitions: [] }], reason: 'Remove copy event.' })
      .expect(409);
    await api()
      .post('/api/en/add/word')
      .query({ dataset: 'copied_words' })
      .set(auth)
      .send(payload(preview))
      .expect(409);
  });

  pg('rejects a stale preview and records prefill changes as reversible field edits', async () => {
    await create('edited_copy');
    const stale = (await api().get(`/api/en/copy-preview/default/${cedar.id}`).set(auth).expect(200))
      .body as EnWordT;
    await api()
      .patch(`/api/en/common-info/${cedar.id}`)
      .set(auth)
      .send({ description: 'source correction' })
      .expect(200);
    await api()
      .post('/api/en/add/word')
      .query({ dataset: 'edited_copy' })
      .set(auth)
      .send(payload(stale))
      .expect(409);
    const preview = (await api().get(`/api/en/copy-preview/default/${cedar.id}`).set(auth).expect(200))
      .body as EnWordT;
    preview.description = 'local correction';
    preview.meanings[0].definition = 'An edited definition.';
    const saved = await api()
      .post('/api/en/add/word')
      .query({ dataset: 'edited_copy' })
      .set(auth)
      .send(payload(preview))
      .expect(201);
    const beforeRevert = await read('edited_copy', saved.body.id as number);
    const history = await api()
      .get('/api/en/changes')
      .query({ dataset: 'edited_copy', headword: 'cedar' })
      .set(auth)
      .expect(200);
    const local = (history.body.items as ChangeT[]).filter((change) => !change.inherited_from);
    expect(local.find((change) => change.diff.description)?.diff.description).toEqual({
      before: 'source correction',
      after: 'local correction',
    });
    const definition = local.find((change) => change.diff.definition)!;
    expect(definition.diff.definition).toEqual({
      before: 'An evergreen tree.',
      after: 'An edited definition.',
    });
    await api()
      .post(`/api/en/changes/${definition.id}/revert`)
      .query({ dataset: 'edited_copy' })
      .set(auth)
      .expect(200);
    expect((await read('edited_copy', saved.body.id as number)).origins).toEqual(beforeRevert.origins);
  });

  pg('forks a fork without activation and keeps the lineage after the parent is deleted', async () => {
    await fork('default', 'first_fork');
    const first = await read('first_fork', cedar.id);
    expect(first.origins).toHaveLength(1);
    expect(first.origins![0]).toMatchObject({
      ...cedar.origins![0],
      acquisitions: [{ method: 'fork', recorded_at: expect.any(String), revision: expect.any(String) }],
    });
    expect(first.licenses).toEqual(cedar.licenses);
    expect(first.alternatives).toEqual(['cedarr']);
    expect(first.etymologies).toEqual(cedar.etymologies);
    expect(first.pronunciations).toEqual(cedar.pronunciations);
    expect(first.forms[0].pronunciations).toEqual(cedar.forms[0].pronunciations);
    expect(first.meanings[0].etymology_number).toBe(1);
    expect(first.meanings[0].quotes).toEqual(cedar.meanings[0].quotes);
    expect((await read('first_fork', first.forms[0].id)).origins).toEqual(first.origins);
    // Check the stored payload as well as the API: no display/projection deduplication.
    const stored = await app
      .get(DataSource)
      .query('SELECT "origins" FROM "ds_first_fork"."en_words" WHERE "id" = $1', [cedar.id]);
    expect(JSON.parse(stored[0].origins)).toEqual(first.origins);
    await api().patch('/api/en/datasets/first_fork').set(auth).send({ origins: null }).expect(400);
    await fork('first_fork', 'second_fork');
    await api().delete('/api/en/datasets/first_fork').set(auth).expect(200);
    const list = await api().get('/api/en/datasets').set(auth).expect(200);
    expect(list.body.active).toBe('default');
    const second = list.body.datasets.find((dataset: { name: string }) => dataset.name === 'second_fork');
    expect(second.origins).toHaveLength(2);
    expect(second.origins.flatMap((origin: OriginT) => origin.acquisitions ?? [])).toHaveLength(2);
    const word = await read('second_fork', cedar.id);
    expect(word.part_of_speech).toBe(EnPartOfSpeechE.noun);
    expect(word.origins).toHaveLength(1);
    const { acquisitions, ...originalTerms } = first.origins![0];
    expect(word.origins![0]).toMatchObject(originalTerms);
    expect(word.origins![0].acquisitions?.[0]).toEqual(acquisitions![0]);
    expect(word.origins![0].acquisitions?.[1]).toMatchObject({
      method: 'fork',
      via: { name: 'first_fork', version: null },
    });
    expect(word.origins!.flatMap((origin) => origin.acquisitions ?? [])).toHaveLength(2);
    expect(word.contributions ?? []).toEqual([]);
    expect(word.licenses).toEqual(first.licenses);
    expect(word.meanings[0].definition).toBe('An evergreen tree.');
  });

  pg('round-trips word and dataset provenance and inherited history through an export', async () => {
    const before = await read('second_fork', cedar.id);
    const datasetBefore = await app.get(DatasetsService).find('second_fork');
    const historyBefore = (
      await api()
        .get('/api/en/changes')
        .query({ dataset: 'second_fork', headword: 'cedar' })
        .set(auth)
        .expect(200)
    ).body.items as ChangeT[];
    await api()
      .patch('/api/en/datasets/second_fork')
      .set(auth)
      .send({
        title: 'Restored fork title',
        attribution: 'Restored attribution',
        description: 'Independent glossary',
        notice: 'A collective source notice.',
      })
      .expect(200);
    const exported = await api()
      .get('/api/en/dictionary/export')
      .query({ dataset: 'second_fork' })
      .set(auth)
      .expect(200);
    const { exportId } = JSON.parse(exported.text.trim().split('\n').at(-1)!) as { exportId: string };
    const archive = await api()
      .get(`/api/en/dictionary/export/download/${exportId}`)
      .set(auth)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const zip = archive.body as Buffer;
    // The released importer has a closed filename allowlist. This mandatory
    // member makes it refuse the archive before importing any entries.
    expect(zip.includes(Buffer.from('dataset-format.json'))).toBe(true);
    expect(zip.includes(Buffer.from('vocab-bloom-hub-en-words.jsonl'))).toBe(true);
    expect(zip.includes(Buffer.from('vocab-bloom-hub-en-changes.jsonl'))).toBe(true);
    expect(zip.includes(Buffer.from('provenance-v1.'))).toBe(false);
    expect(zip.includes(Buffer.from('provenance.v1.json'))).toBe(false);
    await api().delete('/api/en/datasets/second_fork').set(auth).expect(200);
    await create('second_fork');
    const target = await app.get(DatasetsService).reader(await app.get(DatasetsService).find('second_fork'));
    await target.query("SELECT setval(pg_get_serial_sequence('en_etymologies', 'id'), 1000)");
    await target.query("SELECT setval(pg_get_serial_sequence('en_pronunciations', 'id'), 1000)");
    await target.query("SELECT setval(pg_get_serial_sequence('en_pronunciation_audio', 'id'), 2000)");
    const imported = await api()
      .post('/api/en/dictionary/import/upload')
      .set(auth)
      .field('dataset', 'second_fork')
      .attach('archive', zip, 'dataset.zip')
      .expect(201);
    expect(imported.text).not.toContain('"error"');
    const search = await api()
      .get('/api/en/search')
      .query({ dataset: 'second_fork', search: 'cedar' })
      .set(auth)
      .expect(200);
    const restored = await read('second_fork', search.body[0].id as number);
    expect(restored.origins).toEqual(before.origins);
    expect(portablePronunciations(restored.pronunciations)).toEqual(
      portablePronunciations(before.pronunciations),
    );
    expect(restored.pronunciations![0].id).not.toBe(before.pronunciations![0].id);
    expect(restored.pronunciations![0].audio![0].id).not.toBe(before.pronunciations![0].audio![0].id);
    expect(portablePronunciations(restored.forms[0].pronunciations)).toEqual(
      portablePronunciations(before.forms[0].pronunciations),
    );
    expect(restored.forms[0].transcription).toBe('/legacy-seeders/');
    expect(restored.alternatives).toEqual(['cedarr']);
    expect(restored.etymologies?.map(({ number, text }) => ({ number, text }))).toEqual([
      { number: 1, text: 'Invented origin for the transfer fixture.' },
    ]);
    expect(restored.meanings[0].etymology_number).toBe(1);
    expect(restored.meanings[0].quotes).toEqual(before.meanings[0].quotes);
    expect(restored.etymologies![0].id).not.toBe(before.etymologies![0].id);
    expect(restored.licenses).toEqual(before.licenses);
    const listed = await api().get('/api/en/datasets').set(auth).expect(200);
    expect(
      listed.body.datasets.find((dataset: { name: string }) => dataset.name === 'second_fork'),
    ).toMatchObject({
      title: 'Restored fork title',
      attribution: 'Restored attribution',
      description: 'Independent glossary',
      notice: 'A collective source notice.',
      origins: datasetBefore.origins,
    });
    const history = await api()
      .get('/api/en/changes')
      .query({ dataset: 'second_fork', headword: 'cedar' })
      .set(auth)
      .expect(200);
    expect((history.body.items as ChangeT[]).every((change) => !!change.inherited_from)).toBe(true);
    const quoteDiffs = (items: ChangeT[]) =>
      items.filter((change) => change.diff.quotes).map((change) => change.diff.quotes);
    expect(quoteDiffs(historyBefore)).toHaveLength(2);
    expect(quoteDiffs(history.body.items as ChangeT[])).toEqual(quoteDiffs(historyBefore));
    const audioDiffs = (items: ChangeT[]) =>
      items.filter((change) => change.diff.pronunciations).map((change) => change.diff.pronunciations);
    expect(audioDiffs(historyBefore)).toHaveLength(2);
    expect(audioDiffs(history.body.items as ChangeT[])).toEqual(audioDiffs(historyBefore));
    expect((history.body.items as ChangeT[]).map((change) => change.inherited_from)).toEqual(
      historyBefore.map((change) => change.inherited_from),
    );
  });
  pg(
    'distinguishes dataset-wide defaults from explicit word origins and rejects known license conflicts',
    async () => {
      const broad = { ...manual, id: 'undetailed', scope: 'dataset' as const };
      const incompatible = {
        ...broad,
        licenses: [
          {
            spdx: 'CC-BY-SA-4.0',
            name: 'CC BY-SA 4.0',
            url: 'https://creativecommons.org/licenses/by-sa/4.0/',
          },
        ],
      };
      await api()
        .post('/api/en/datasets')
        .set(auth)
        .send({
          name: 'bad_terms',
          title: 'Bad',
          license: { spdx: 'CC0-1.0' },
          attribution: 'Owner',
          origins: [incompatible],
        })
        .expect(409);
      await api()
        .post('/api/en/datasets')
        .set(auth)
        .send({
          name: 'detailed_terms',
          title: 'Detailed',
          license: { spdx: 'CC-BY-4.0' },
          attribution: 'Owner',
          origins: [broad],
        })
        .expect(201);
      const source = (word: string, origins?: OriginT[]) => ({
        word,
        part_of_speech: 'noun',
        forms: [],
        origins,
      });
      const manifest = portableManifest({
        version: '2026.1',
        source: 'detailed_terms',
        license: 'CC-BY-4.0',
        provenance_format: 1,
        provenance: {
          title: 'Detailed',
          notice: 'Not all records have detailed attribution.',
          origins: [broad],
          description: null,
          license_text: null,
        },
        files: { [DATASET_FILE_NAMES.words]: { lines: 2 } },
      });
      await api()
        .post('/api/en/dictionary/import/upload')
        .set(auth)
        .field('dataset', 'detailed_terms')
        .attach(
          'words',
          Buffer.from(
            [source('specific', [manual]), source('collective')].map((line) => JSON.stringify(line)).join('\n'),
          ),
          DATASET_FILE_NAMES.words,
        )
        .attach('manifest', Buffer.from(JSON.stringify(manifest)), 'manifest.json')
        .attach('provenance', Buffer.from('{"format":1}'), 'dataset-format.json')
        .expect(201);
      const specific = await api().get('/api/v1/words/specific/datasets').expect(200);
      expect(
        specific.body.data.find((group: { dataset: string }) => group.dataset === 'detailed_terms').entries[0]
          .origins,
      ).toEqual([manual]);
      const collective = await api().get('/api/v1/words/collective/datasets').expect(200);
      expect(
        collective.body.data.find((group: { dataset: string }) => group.dataset === 'detailed_terms').entries[0]
          .origins,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'undetailed', scope: 'dataset', inherited: true }),
          expect.objectContaining({
            method: 'dataset',
            notices: ['Not all records have detailed attribution.'],
          }),
        ]),
      );
      // Older words may still resolve their default terms from the registry.
      const collectiveId = collective.body.data.find(
        (group: { dataset: string }) => group.dataset === 'detailed_terms',
      ).entries[0].id as number;
      await app
        .get(DataSource)
        .query('UPDATE "ds_detailed_terms"."en_words" SET "origins" = NULL WHERE "id" = $1', [collectiveId]);
      await fork('detailed_terms', 'mixed_origins_fork');
      const defaulted = await read('mixed_origins_fork', collectiveId);
      expect(defaulted.origins).toHaveLength(2);
      expect(defaulted.origins).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            method: 'dataset',
            acquisitions: [expect.objectContaining({ method: 'fork' })],
          }),
          { ...broad, inherited: true },
        ]),
      );
      expect(defaulted.licenses).toHaveLength(2);
      const specificId = specific.body.data.find(
        (group: { dataset: string }) => group.dataset === 'detailed_terms',
      ).entries[0].id as number;
      const detailed = await read('mixed_origins_fork', specificId);
      expect(detailed.origins).toHaveLength(1);
      expect(detailed.origins![0]).toMatchObject({ ...manual, inherited: true });
      expect(detailed.origins![0].acquisitions).toEqual([
        expect.objectContaining({ method: 'fork', via: { name: 'Detailed', version: '2026.1' } }),
      ]);
      expect(detailed.origins!.some((origin) => origin.id === broad.id)).toBe(false);
      await create('share_alike', 'CC-BY-SA-4.0');
      await api()
        .patch('/api/en/datasets/share_alike')
        .set(auth)
        .send({ origins: [incompatible] })
        .expect(200);
      await api()
        .patch('/api/en/datasets/share_alike')
        .set(auth)
        .send({ license: { spdx: 'CC0-1.0' } })
        .expect(409);
    },
  );

  pg('does not finish a fork until the copied data and provenance have committed', async () => {
    const connection = app.get(DataSource);
    const original = connection.createQueryRunner.bind(connection);
    let reached!: () => void;
    const finalizing = new Promise<void>((resolve) => {
      reached = resolve;
    });
    let release!: () => void;
    const proceed = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spy = jest.spyOn(connection, 'createQueryRunner').mockImplementation((mode) => {
      const runner = original(mode);
      const query = runner.query.bind(runner);
      const commit = runner.commitTransaction.bind(runner);
      let isFork = false;
      runner.query = (async (...args: Parameters<typeof query>) => {
        if (args[0] === 'CREATE SCHEMA "ds_pending_fork"') isFork = true;
        return query(...args);
      }) as typeof runner.query;
      runner.commitTransaction = async () => {
        if (isFork) {
          reached();
          await proceed;
        }
        await commit();
      };
      return runner;
    });
    try {
      await api()
        .post('/api/en/datasets/default/fork')
        .set(auth)
        .send({ name: 'pending_fork', title: 'Pending', license: { spdx: 'CC-BY-4.0' }, attribution: 'Owner' })
        .expect(202);
      await finalizing;
      const progress = (await api().get('/api/en/datasets/pending_fork/fork-status').set(auth).expect(200))
        .body as ForkProgressT;
      expect(progress.total_tables).toBeGreaterThan(0);
      expect(progress.completed_tables).toBe(progress.total_tables);
      expect(progress.state).toBe('copying');
      const list = await api().get('/api/en/datasets').set(auth).expect(200);
      expect(list.body.datasets.some((item: { name: string }) => item.name === 'pending_fork')).toBe(false);
      await api().get(`/api/en/${cedar.id}`).query({ dataset: 'pending_fork' }).set(auth).expect(404);
      release();
      for (let attempt = 0; attempt < 200; attempt++) {
        const status = await api().get('/api/en/datasets/pending_fork/fork-status').set(auth).expect(200);
        if (status.body.state !== 'copying') break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(
        (await api().get('/api/en/datasets/pending_fork/fork-status').set(auth).expect(200)).body.state,
      ).toBe('completed');
      const word = await read('pending_fork', cedar.id);
      expect(word.origins).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            method: 'dataset',
            inherited: true,
            acquisitions: [expect.objectContaining({ method: 'fork' })],
          }),
        ]),
      );
    } finally {
      release();
      spy.mockRestore();
    }
  });

  pg('keeps an in-progress fork inaccessible and rolls back its schema after a copy failure', async () => {
    const connection = app.get(DataSource);
    const original = connection.createQueryRunner.bind(connection);
    let reached!: () => void;
    const copying = new Promise<void>((resolve) => {
      reached = resolve;
    });
    let release!: () => void;
    const proceed = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spy = jest.spyOn(connection, 'createQueryRunner').mockImplementation((mode) => {
      const runner = original(mode);
      const query = runner.query.bind(runner);
      runner.query = (async (...args: Parameters<typeof query>) => {
        if (args[0].startsWith('INSERT INTO "ds_failed_fork"."en_entries"')) {
          reached();
          await proceed;
          throw new Error('Simulated storage failure during the copy');
        }
        return query(...args);
      }) as typeof runner.query;
      return runner;
    });
    try {
      await api()
        .post('/api/en/datasets/default/fork')
        .set(auth)
        .send({ name: 'failed_fork', title: 'Failed', license: { spdx: 'CC-BY-4.0' }, attribution: 'Owner' })
        .expect(202);
      await copying;
      const list = await api().get('/api/en/datasets').set(auth).expect(200);
      expect(list.body.datasets.some((item: { name: string }) => item.name === 'failed_fork')).toBe(false);
      await api().get(`/api/en/${cedar.id}`).query({ dataset: 'failed_fork' }).set(auth).expect(404);
      release();
      for (let attempt = 0; attempt < 200; attempt++) {
        const progress = await api().get('/api/en/datasets/failed_fork/fork-status').set(auth).expect(200);
        if (progress.body.state === 'failed') break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect((await api().get('/api/en/datasets/failed_fork/fork-status').set(auth)).body.state).toBe('failed');
      expect(await connection.query("SELECT 1 FROM pg_namespace WHERE nspname = 'ds_failed_fork'")).toEqual([]);
    } finally {
      release();
      spy.mockRestore();
    }
    await fork('default', 'failed_fork');
  });
  pg(
    'upgrades the previous migration name and stored scopes without overwriting source snapshots',
    async () => {
      await fork('default', 'upgrade_origins');
      const connection = app.get(DataSource);
      const legacy = { ...manual, scope: 'article', notices: ['Original article attribution.'] };
      await connection.query('UPDATE "ds_upgrade_origins"."en_words" SET "origins" = $1 WHERE "id" = $2', [
        JSON.stringify([legacy]),
        cedar.id,
      ]);
      await connection.query('UPDATE "public"."datasets" SET "origins" = $1 WHERE "name" = $2', [
        JSON.stringify([legacy]),
        'upgrade_origins',
      ]);
      await connection.query(
        'UPDATE "ds_upgrade_origins"."en_changes" SET "inherited_from" = $1, "diff" = $2',
        [JSON.stringify(legacy), JSON.stringify({ origins: { before: [legacy], after: [legacy] } })],
      );
      await connection.query(
        `UPDATE "ds_upgrade_origins"."dataset_migrations" SET "name" = 'AddArticleOrigins1790200000000' WHERE "name" = 'AddWordOrigins1790200000000'`,
      );
      await connection.query(
        `DELETE FROM "ds_upgrade_origins"."dataset_migrations" WHERE "name" = 'NormalizeWordOrigins1790200001000'`,
      );
      expect(await runDatasetMigrations('ds_upgrade_origins')).toEqual([
        'AddWordOrigins1790200000000',
        'NormalizeWordOrigins1790200001000',
      ]);
      const expected = { ...legacy, scope: 'word' };
      expect((await read('upgrade_origins', cedar.id)).origins).toEqual([expected]);
      const [dataset] = await connection.query('SELECT "origins" FROM "public"."datasets" WHERE "name" = $1', [
        'upgrade_origins',
      ]);
      expect(JSON.parse(dataset.origins)).toEqual([expected]);
      const history = await connection.query(
        'SELECT "diff", "inherited_from" FROM "ds_upgrade_origins"."en_changes"',
      );
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].diff.origins.before).toEqual([expected]);
      expect(JSON.parse(history[0].inherited_from)).toEqual(expected);
      expect(await runDatasetMigrations('ds_upgrade_origins')).toEqual([]);
    },
  );
  pg('reserves a fork before preflight and reports completion only after releasing its lock', async () => {
    const service = app.get(DatasetsService);
    const audit = app.get(AuditService);
    const find = service.find.bind(service);
    const record = audit.record.bind(audit);
    let preflightReached!: () => void;
    const preflight = new Promise<void>((resolve) => {
      preflightReached = resolve;
    });
    let releasePreflight!: () => void;
    const preflightGate = new Promise<void>((resolve) => {
      releasePreflight = resolve;
    });
    let auditReached!: () => void;
    const auditing = new Promise<void>((resolve) => {
      auditReached = resolve;
    });
    let releaseAudit!: () => void;
    const auditGate = new Promise<void>((resolve) => {
      releaseAudit = resolve;
    });
    const findSpy = jest.spyOn(service, 'find').mockImplementationOnce(async (name) => {
      preflightReached();
      await preflightGate;
      return find(name);
    });
    const auditSpy = jest.spyOn(audit, 'record').mockImplementation(async (event) => {
      if (event.headword === 'serial_fork') {
        auditReached();
        await auditGate;
      }
      return record(event);
    });
    const body = { name: 'serial_fork', title: 'Serial', license: { spdx: 'CC-BY-4.0' }, attribution: 'Owner' };
    const started = service.fork('default', body);
    try {
      await preflight;
      await expect(service.fork('default', body)).rejects.toThrow('datasets_busy');
      releasePreflight();
      expect((await started).state).toBe('copying');
      await auditing;
      expect(service.forkProgress('serial_fork').state).toBe('copying');
      await api()
        .post('/api/en/dictionary/import/upload')
        .set(auth)
        .attach('words', Buffer.from('{"word":"blocked-import","part_of_speech":"noun"}\n'), 'words.jsonl')
        .expect(409);
      releaseAudit();
      for (
        let attempt = 0;
        attempt < 200 && service.forkProgress('serial_fork').state === 'copying';
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(service.forkProgress('serial_fork').state).toBe('completed');
      await api().delete('/api/en/datasets/serial_fork').set(auth).expect(200);
    } finally {
      releasePreflight();
      releaseAudit();
      await started;
      findSpy.mockRestore();
      auditSpy.mockRestore();
    }
  });
});
