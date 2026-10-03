import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { checkIsPostgres } from '../configuration';
import { createJwt } from '../core/utils/auth';
import { hashLoginString } from '../core/utils/crypto';
import { AppModule } from '../src/modules/AppModule/app.module';
import { EnDictionaryImportPhasesE } from '../src/modules/EnModule/modules/EnImportDictionary/constants';
import type { ChangeT, EnWordT, ForkProgressT, OriginT, PublicWordDatasetsV1ResT } from '../types';

const postgres = checkIsPostgres() ? describe : describe.skip;

postgres('licenses of contributions to a fork', () => {
  let app: INestApplication<App>;
  const auth = { Authorization: '' };
  const api = () => request(app.getHttpServer());
  let verb: EnWordT;
  let noun: EnWordT;
  let pinned: OriginT[];
  let copiedId: number;
  const read = async (dataset: string, id: number): Promise<EnWordT> =>
    (await api().get(`/api/en/${id}`).query({ dataset }).set(auth).expect(200)).body as EnWordT;
  const history = async (dataset: string): Promise<ChangeT[]> =>
    (await api().get('/api/en/changes').query({ dataset, headword: 'make' }).set(auth).expect(200)).body
      .items as ChangeT[];
  const create = (name: string, license = 'ODbL-1.0') =>
    api()
      .post('/api/en/datasets')
      .set(auth)
      .send({ name, title: name, license: { spdx: license }, attribution: 'Local editors' })
      .expect(201);
  const fork = async (parent: string, name: string, license = 'ODbL-1.0', version?: string) => {
    await api()
      .post(`/api/en/datasets/${parent}/fork`)
      .set(auth)
      .send({ name, title: name, license: { spdx: license }, attribution: `${name} editors`, version })
      .expect(202);
    for (let i = 0; i < 200; i++) {
      const status = (await api().get(`/api/en/datasets/${name}/fork-status`).set(auth).expect(200))
        .body as ForkProgressT;
      if (status.state === 'completed') return;
      if (status.state === 'failed') throw new Error(status.failure);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error('fork timed out');
  };
  const edit = (dataset: string, description: string) =>
    api()
      .patch(`/api/en/common-info/${verb.id}`)
      .query({ dataset })
      .set(auth)
      .send({ description })
      .expect(200);
  const exportArchive = async (dataset: string): Promise<Buffer> => {
    const exported = await api().get('/api/en/dictionary/export').query({ dataset }).set(auth).expect(200);
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
    return archive.body as Buffer;
  };
  const copy = async (source: string, target: string, id: number) => {
    const preview = (await api().get(`/api/en/copy-preview/${source}/${id}`).set(auth).expect(200))
      .body as EnWordT;
    const { licenses: _licenses, contributions: _contributions, user_modified: _modified, ...body } = preview;
    const saved = await api()
      .post('/api/en/add/word')
      .query({ dataset: target })
      .set(auth)
      .send(body)
      .expect(201);
    return read(target, saved.body.id as number);
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
    const words = ['verb', 'noun'].map((part_of_speech) => ({
      word: 'make',
      part_of_speech,
      version: 'source-1',
      generated: false,
      description: 'Original description',
      forms:
        part_of_speech === 'verb'
          ? [
              {
                word: 'makes',
                form_of_word: 'third_person_singular',
                area_variant: 'common',
                transcription: '',
              },
            ]
          : [],
      meanings: [
        {
          title: 'Example',
          definition: 'Original definition',
          sort_order: 0,
          area_variant: 'common',
          examples: [],
          categories: [],
          translations: [],
        },
      ],
      short_translations: [],
    }));
    await api()
      .post('/api/en/dictionary/import/upload')
      .set(auth)
      .attach('words', Buffer.from(words.map((word) => JSON.stringify(word)).join('\n') + '\n'), 'words.jsonl')
      .expect(201);
    const original = await api().get('/api/v1/words/make').expect(200);
    verb = await read(
      'default',
      (original.body.data as EnWordT[]).find((word) => word.part_of_speech === 'verb')!.id,
    );
    noun = await read(
      'default',
      (original.body.data as EnWordT[]).find((word) => word.part_of_speech === 'noun')!.id,
    );
  });
  afterAll(async () => {
    await app?.close();
  });

  it('creates an own dataset with a version and exposes edits and clearing through public metadata', async () => {
    const version = 'v'.repeat(64);
    const created = await api()
      .post('/api/en/datasets')
      .set(auth)
      .send({
        name: 'versioned_words',
        title: 'Versioned words',
        version,
        license: { spdx: 'CC-BY-4.0' },
        attribution: 'Editors',
      })
      .expect(201);
    expect(created.body.version).toBe(version);
    await api().post('/api/en/datasets/versioned_words/activate').set(auth).expect(200);
    expect((await api().get('/api/v1/meta').expect(200)).body.data.dataset_version).toBe(version);
    const updated = await api()
      .patch('/api/en/datasets/versioned_words')
      .set(auth)
      .send({ version: ' 1.0.0 ' })
      .expect(200);
    expect(updated.body.version).toBe('1.0.0');
    expect((await api().get('/api/v1/meta').expect(200)).body.data.dataset_version).toBe('1.0.0');
    await api().patch('/api/en/datasets/versioned_words').set(auth).send({ title: 'New title' }).expect(200);
    expect((await api().get('/api/v1/meta').expect(200)).body.data.dataset_version).toBe('1.0.0');
    await api().patch('/api/en/datasets/versioned_words').set(auth).send({ version: null }).expect(200);
    expect((await api().get('/api/v1/meta').expect(200)).body.data.dataset_version).toBeNull();
    await api().post('/api/en/datasets/default/activate').set(auth).expect(200);
  });

  it('pins an unknown contribution version and records each subsequent version only on content edits', async () => {
    await fork('default', 'version_history');
    await edit('version_history', 'Edited before assigning a version');
    const original = await read('version_history', verb.id);
    expect(original.contributions?.map((origin) => origin.version)).toEqual([null]);
    for (const version of ['1.0.0', '2.0.0']) {
      const previous = await read('version_history', verb.id);
      const changes = await history('version_history');
      await api().patch('/api/en/datasets/version_history').set(auth).send({ version }).expect(200);
      expect((await read('version_history', verb.id)).contributions).toEqual(previous.contributions);
      expect(await history('version_history')).toEqual(changes);
      await edit('version_history', `Edited in ${version}`);
    }
    const updated = await read('version_history', verb.id);
    expect(updated.origins).toEqual(original.origins);
    expect(updated.contributions?.map((origin) => origin.version)).toEqual([null, '1.0.0', '2.0.0']);
    expect((await history('version_history')).map((change) => change.contribution?.version)).toEqual([
      '2.0.0',
      '1.0.0',
      null,
    ]);
  });

  it('keeps only original terms after a fork, a no-op save, and a fork of that fork', async () => {
    await fork('default', 'contribution_fork', 'ODbL-1.0', ' fork-1 ');
    await edit('contribution_fork', verb.description!);
    const unchanged = await read('contribution_fork', verb.id);
    expect(unchanged.contributions ?? []).toEqual([]);
    expect(unchanged.licenses).toEqual(verb.licenses);
    expect(await history('contribution_fork')).toEqual([]);
    await fork('contribution_fork', 'unchanged_fork');
    expect((await read('unchanged_fork', verb.id)).licenses).toEqual(verb.licenses);
    expect((await read('unchanged_fork', verb.id)).origins![0].acquisitions?.at(-1)).toMatchObject({
      method: 'fork',
      recorded_at: expect.any(String),
      via: { name: 'contribution_fork', version: 'fork-1' },
    });
  });

  it('adds the fork terms only to the edited part of speech and inherits them on forms', async () => {
    await edit('contribution_fork', 'First local edit');
    const changed = await read('contribution_fork', verb.id);
    expect(changed.origins).toHaveLength(1);
    expect(changed.contributions).toHaveLength(1);
    expect(changed.contributions![0]).toMatchObject({
      name: 'contribution_fork',
      version: 'fork-1',
      attribution: 'contribution_fork editors',
      licenses: [{ spdx: 'ODbL-1.0' }],
    });
    expect(changed.licenses!.map((license) => license.spdx)).toEqual(['CC-BY-4.0', 'ODbL-1.0']);
    expect((await read('contribution_fork', noun.id)).licenses).toEqual(noun.licenses);
    expect((await read('contribution_fork', changed.forms[0].id)).contributions).toEqual(changed.contributions);
    const groups = (await api().get('/api/v1/words/make/datasets').expect(200))
      .body as PublicWordDatasetsV1ResT;
    const entry = groups.data
      .find((group) => group.dataset === 'contribution_fork')!
      .entries.find((word) => word.part_of_speech === 'verb')!;
    expect(entry.modified).toBe(true);
    expect(entry.contributions).toEqual(changed.contributions);
    expect(entry.licenses).toEqual(changed.licenses);
    const changes = await history('contribution_fork');
    expect(changes[0].contribution).toEqual(changed.contributions![0]);
    const publicHistory = await api().get('/api/v1/words/make/datasets/contribution_fork/history').expect(200);
    expect(publicHistory.body.data[0].contribution).toEqual(changed.contributions![0]);
    await api().post('/api/en/datasets/contribution_fork/activate').set(auth).expect(200);
    const meanings = await api().get('/api/v1/words/make/meanings').expect(200);
    expect(
      meanings.body.data.find((item: { part_of_speech: string }) => item.part_of_speech === 'verb')
        .contributions,
    ).toEqual(changed.contributions);
    const searched = await api().get('/api/v1/search').query({ search: 'make' }).expect(200);
    expect(
      searched.body.data.find((item: { part_of_speech: string }) => item.part_of_speech === 'verb').licenses,
    ).toEqual(changed.licenses);
    await api().post('/api/en/datasets/default/activate').set(auth).expect(200);
  });

  it('reuses identical terms and pins older terms when the dataset changes', async () => {
    await edit('contribution_fork', 'Second local edit');
    const before = await read('contribution_fork', verb.id);
    expect(before.contributions).toHaveLength(1);
    expect(new Set((await history('contribution_fork')).map((change) => change.contribution?.id)).size).toBe(1);
    await api()
      .patch('/api/en/datasets/contribution_fork')
      .set(auth)
      .send({ title: 'Renamed fork', attribution: 'New contribution terms', version: 'fork-2' })
      .expect(200);
    expect((await read('contribution_fork', verb.id)).contributions).toEqual(before.contributions);
    await edit('contribution_fork', 'Third local edit');
    pinned = (await read('contribution_fork', verb.id)).contributions!;
    expect(pinned).toHaveLength(2);
    expect(pinned[0]).toEqual(before.contributions![0]);
    expect(pinned[1]).toMatchObject({
      name: 'Renamed fork',
      version: 'fork-2',
      attribution: 'New contribution terms',
      licenses: [{ spdx: 'ODbL-1.0' }],
    });
  });

  it('preserves contributions through copying and another fork without inventing a new contribution', async () => {
    await create('contribution_copy');
    const copied = await copy('contribution_fork', 'contribution_copy', verb.id);
    copiedId = copied.id;
    expect(copied.contributions).toEqual(pinned);
    expect(copied.origins).toHaveLength(1);
    expect(copied.licenses).toHaveLength(3);
    expect(
      (await history('contribution_copy')).every((change) => change.inherited_from && !change.revertible),
    ).toBe(true);
    const unchanged = await copy('contribution_fork', 'contribution_copy', noun.id);
    expect(unchanged.contributions ?? []).toEqual([]);
    expect(unchanged.origins![0].acquisitions?.at(-1)).toMatchObject({
      method: 'copy',
      recorded_at: expect.any(String),
      via: { name: 'Renamed fork', version: 'fork-2' },
    });
    expect(unchanged.licenses).toEqual(noun.licenses);
    await fork('contribution_fork', 'contribution_child');
    expect((await read('contribution_child', verb.id)).contributions).toEqual(pinned);
    expect((await read('contribution_child', noun.id)).licenses).toEqual(noun.licenses);
  });

  it('round-trips contribution snapshots and their active history through export/import', async () => {
    const exported = await api()
      .get('/api/en/dictionary/export')
      .query({ dataset: 'contribution_copy' })
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
    await api().delete('/api/en/datasets/contribution_copy').set(auth).expect(200);
    await create('contribution_copy');
    const imported = await api()
      .post('/api/en/dictionary/import/upload')
      .set(auth)
      .field('dataset', 'contribution_copy')
      .attach('archive', archive.body as Buffer, 'dataset.zip')
      .expect(201);
    expect(JSON.parse(imported.text.trim().split('\n').at(-1)!)).toMatchObject({
      stage: EnDictionaryImportPhasesE.completed,
    });
    const groups = (await api().get('/api/v1/words/make/datasets').expect(200))
      .body as PublicWordDatasetsV1ResT;
    const restored = groups.data
      .find((group) => group.dataset === 'contribution_copy')!
      .entries.find((word) => word.part_of_speech === 'verb')!;
    copiedId = restored.id;
    expect(restored.contributions).toEqual(pinned);
    expect(restored.licenses).toHaveLength(3);
  });

  it('retires contribution terms after all local edits are reverted and retains them in independent copies', async () => {
    for (const change of await history('contribution_fork')) {
      await api()
        .post(`/api/en/changes/${change.id}/revert`)
        .query({ dataset: 'contribution_fork' })
        .set(auth)
        .expect(200);
    }
    const restored = await read('contribution_fork', verb.id);
    expect(restored.description).toBe(verb.description);
    expect(restored.contributions ?? []).toEqual([]);
    expect(restored.licenses).toEqual(verb.licenses);
    expect(
      (await history('contribution_fork'))
        .filter((change) => change.contribution)
        .every((change) => change.superseded_at),
    ).toBe(true);
    await api().delete('/api/en/datasets/contribution_fork').set(auth).expect(200);
    expect((await read('contribution_child', verb.id)).contributions).toEqual(pinned);
    expect((await read('contribution_copy', copiedId)).contributions).toEqual(pinned);
  });

  it('pins changed licenses and applies existing compatibility checks to contributions during transfer', async () => {
    await fork('default', 'license_change', 'CC-BY-4.0');
    await edit('license_change', 'Edit under the first license');
    const before = (await read('license_change', verb.id)).contributions!;
    await api()
      .patch('/api/en/datasets/license_change')
      .set(auth)
      .send({ license: { spdx: 'ODbL-1.0' } })
      .expect(200);
    expect((await read('license_change', verb.id)).contributions).toEqual(before);
    await edit('license_change', 'Edit under the second license');
    expect(
      (await read('license_change', verb.id)).contributions!.map((origin) => origin.licenses[0].spdx),
    ).toEqual(['CC-BY-4.0', 'ODbL-1.0']);
    await create('incompatible_copy', 'CC-BY-4.0');
    const preview = (await api().get(`/api/en/copy-preview/license_change/${verb.id}`).set(auth).expect(200))
      .body as EnWordT;
    const { licenses: _licenses, contributions: _contributions, user_modified: _modified, ...body } = preview;
    await api()
      .post('/api/en/add/word')
      .query({ dataset: 'incompatible_copy' })
      .set(auth)
      .send(body)
      .expect(409);
    await api()
      .patch('/api/en/datasets/license_change')
      .set(auth)
      .send({ license: { spdx: 'CC-BY-4.0' } })
      .expect(409);
  });

  it('round-trips reverted contributions after the dataset license changes', async () => {
    const dataset = 'reverted_terms';
    await fork('default', dataset);
    await edit(dataset, 'Temporary ODbL contribution');
    for (const change of await history(dataset)) {
      await api().post(`/api/en/changes/${change.id}/revert`).query({ dataset }).set(auth).expect(200);
    }
    await api()
      .patch(`/api/en/datasets/${dataset}`)
      .set(auth)
      .send({ license: { spdx: 'CC-BY-4.0' } })
      .expect(200);
    const before = await history(dataset);
    const archive = await exportArchive(dataset);
    await api().delete(`/api/en/datasets/${dataset}`).set(auth).expect(200);
    await create(dataset, 'CC-BY-4.0');
    const imported = await api()
      .post('/api/en/dictionary/import/upload')
      .set(auth)
      .field('dataset', dataset)
      .attach('archive', archive, 'dataset.zip')
      .expect(201);
    expect(JSON.parse(imported.text.trim().split('\n').at(-1)!)).toMatchObject({
      stage: EnDictionaryImportPhasesE.completed,
    });
    expect((await history(dataset)).map(({ id: _id, ...change }) => change)).toEqual(
      before.map(({ id: _id, ...change }) => change),
    );
    const groups = (await api().get('/api/v1/words/make/datasets').expect(200))
      .body as PublicWordDatasetsV1ResT;
    const restored = groups.data
      .find((group) => group.dataset === dataset)!
      .entries.find((word) => word.part_of_speech === 'verb')!;
    expect(restored.contributions ?? []).toEqual([]);
    expect(restored.licenses).toEqual(verb.licenses);
  });

  it('restores an explicitly unknown dataset version instead of retaining the target version', async () => {
    const dataset = 'unknown_version';
    await fork('default', dataset);
    const archive = await exportArchive(dataset);
    await api().delete(`/api/en/datasets/${dataset}`).set(auth).expect(200);
    await create(dataset);
    await api().patch(`/api/en/datasets/${dataset}`).set(auth).send({ version: 'later-version' }).expect(200);
    await api().post(`/api/en/datasets/${dataset}/activate`).set(auth).expect(200);
    const imported = await api()
      .post('/api/en/dictionary/import/upload')
      .set(auth)
      .field('dataset', dataset)
      .attach('archive', archive, 'dataset.zip')
      .expect(201);
    expect(JSON.parse(imported.text.trim().split('\n').at(-1)!)).toMatchObject({
      stage: EnDictionaryImportPhasesE.completed,
    });
    expect((await api().get('/api/v1/meta').expect(200)).body.data.dataset_version).toBeNull();
    await api().post('/api/en/datasets/default/activate').set(auth).expect(200);
  });
});
