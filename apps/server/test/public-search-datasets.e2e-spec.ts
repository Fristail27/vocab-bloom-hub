import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/modules/AppModule/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { DatasetsService } from '../src/modules/DatasetsModule/datasets.service';
import { EnSearchService } from '../src/modules/EnModule/modules/EnSearch/enSearch.service';
import { EnChange } from '../src/modules/EnModule/entities/en_change.entity';
import { createJwt } from '../core/utils/auth';
import { hashLoginString } from '../core/utils/crypto';
import { apiCorsOptions } from '../src/core/utils/api-cors';
import { checkIsPostgres } from '../configuration';
import { PublicSearchDatasetsV1ResT } from '../types';

const OTHER = 'search_other';
const CLOSED = 'search_closed';
const pg = checkIsPostgres() ? it : it.skip;

describe('selected and grouped public search (#652)', () => {
  let app: INestApplication<App>;
  let datasets: DatasetsService;
  const auth = { Authorization: '' };
  const savedRate = process.env.PUBLIC_API_RATE_LIMIT;
  const server = () => app.getHttpServer();
  const add = async (word: string, dataset = 'default', description = dataset) =>
    request(server())
      .post('/api/en/add/word')
      .query({ dataset })
      .set(auth)
      .send({
        word,
        description,
        part_of_speech: 'noun',
        form_of_word: 'base_form',
        meanings: [
          {
            title: description,
            definition: description,
            is_obsolete: false,
            sort_order: 1,
            examples: [],
            area_variant: 'common',
            translations: [{ language: 'ru', title: 'янтарь', definition: description, variants_of_words: [] }],
          },
        ],
      })
      .expect(201);
  const grouped = (names = ['default'], extra: Record<string, unknown> = {}) =>
    request(server())
      .get('/api/v1/search/datasets')
      .query({ search: 'amber', datasets: names, ...extra });

  beforeAll(async () => {
    process.env.ADMIN_USERNAME = 'search-admin';
    process.env.ADMIN_PASSWORD = 'search-password';
    process.env.PUBLIC_API_RATE_LIMIT = '10000/60';
    const hash = await hashLoginString('search-admin', 'search-password');
    const secret = await hashLoginString('search-admin', hash);
    auth.Authorization = `Bearer ${createJwt({ role: 'admin' }, secret + hash)}`;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.enableCors(apiCorsOptions(['https://site.example']));
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost).httpAdapter));
    await app.listen(0, '127.0.0.1');
    datasets = app.get(DatasetsService);
    await add('amber');
    await add('ambergris');
    if (checkIsPostgres()) {
      for (const name of [OTHER, CLOSED]) {
        await request(server())
          .post('/api/en/datasets')
          .set(auth)
          .send({
            name,
            title: `Dictionary ${name}`,
            license: { spdx: 'CC0-1.0' },
            attribution: `Author ${name}`,
          })
          .expect(201);
      }
      await datasets.setVisibility(OTHER, true);
      await add('amber', OTHER);
      await add('Amber', OTHER, 'a name');
      await add('amberjack', OTHER);
      await add('receive', OTHER);
      await add('confidential', CLOSED);
      // A different edit history for the same local IDs proves modified is scoped too.
      await (await datasets.reader(await datasets.find(OTHER))).getRepository(EnChange).clear();
    }
  });

  afterAll(async () => {
    if (savedRate === undefined) delete process.env.PUBLIC_API_RATE_LIMIT;
    else process.env.PUBLIC_API_RATE_LIMIT = savedRate;
    await app?.close();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    process.env.PUBLIC_API_RATE_LIMIT = '10000/60';
  });

  it('preserves the default envelope and selects the SQLite/default dictionary explicitly', async () => {
    const old = await request(server())
      .get('/api/v1/search?search=amber')
      .set('Origin', 'https://site.example')
      .expect(200);
    expect(old.body.meta).toEqual({ count: 2, fuzzy: false, short_term: false });
    expect(old.headers['x-dataset']).toBe('default');
    expect(old.headers['access-control-expose-headers']).toContain('X-Dataset');
    const explicit = await request(server()).get('/api/v1/search?search=amber&dataset=default').expect(200);
    expect(explicit.body.data).toEqual(old.body.data);
    expect(explicit.body.meta).toEqual({ ...old.body.meta, dataset: 'default' });
    expect(explicit.headers['cache-control']).toBe('public, no-cache, must-revalidate');
    expect(explicit.headers['last-modified']).toBeDefined();
    await request(server())
      .get('/api/v1/search?search=amber&dataset=default')
      .set('If-None-Match', explicit.headers.etag)
      .expect(304);
    await request(server())
      .get('/api/v1/search?search=amber&dataset=default')
      .set('If-Modified-Since', explicit.headers['last-modified'])
      .expect(200);
    const group = (await grouped().expect(200)).body as PublicSearchDatasetsV1ResT;
    expect(group.meta).toEqual({ datasets: 1, partial: false });
    expect(group.data[0]).toMatchObject({
      dataset: 'default',
      status: 'ok',
      meta: { page: 1, limit: 10, has_more: false },
    });
    const inventory = await request(server()).get('/api/v1/datasets').expect(200);
    expect(inventory.body.meta.max_search_datasets).toBe(5);
    expect(inventory.body.data.map((d: { dataset: string }) => d.dataset)).toEqual(
      checkIsPostgres() ? ['default', OTHER] : ['default'],
    );
  });

  it('validates the complete bounded selection before opening readers and never falls back', async () => {
    const reader = jest.spyOn(datasets, 'reader');
    for (const names of [[], ['default', 'default'], ['default', 'aa', 'bb', 'cc', 'dd', 'ee'], ['bad!']]) {
      await grouped(names).expect(400);
    }
    for (const name of [CLOSED, 'unknown']) {
      const single = await request(server())
        .get('/api/v1/search')
        .query({ search: 'amber', dataset: name })
        .expect(404);
      expect(JSON.stringify(single.body)).not.toContain(name);
      const multi = await grouped(['default', name]).expect(404);
      expect(multi.body).toEqual(single.body);
    }
    await grouped(['default'], { dataset: 'default' }).expect(400);
    await grouped(['default'], { limit: 21 }).expect(400);
    await grouped(['default'], { page: 21 }).expect(400);
    await request(server()).get('/api/v1/search?search=amber&dataset=default&dataset=default').expect(400);
    expect(reader).not.toHaveBeenCalled();
  });

  it('keeps empty results distinct from a failed reader, with no internal error details or cached failures', async () => {
    const empty = (await grouped(['default'], { search: 'qzxwqzx' }).expect(200)).body;
    expect(empty.data[0]).toMatchObject({ status: 'ok', data: [] });
    jest.spyOn(datasets, 'reader').mockRejectedValue(new Error('private connection and schema details'));
    const failed = await grouped().expect(200);
    expect(failed.body.meta.partial).toBe(true);
    expect(failed.body.data[0]).toMatchObject({ status: 'unavailable', error: 'dataset_unavailable' });
    expect(failed.body.data[0]).not.toHaveProperty('data');
    expect(failed.body.data[0]).not.toHaveProperty('meta');
    expect(JSON.stringify(failed.body)).not.toContain('private');
    expect(failed.headers['cache-control']).toBe('no-store');
    await grouped().set('If-None-Match', failed.headers.etag).expect(200);
    await request(server()).get('/api/v1/search?search=amber&dataset=default').expect(503);
  });

  pg('finds inactive-only words and preserves local IDs, spelling, attribution and history', async () => {
    const old = await request(server()).get('/api/v1/search?search=receive').expect(200);
    expect(old.body.data).toEqual([]);
    const single = await request(server()).get(`/api/v1/search?search=receive&dataset=${OTHER}`).expect(200);
    expect(single.body.data).toEqual([
      expect.objectContaining({ word: 'receive', source: OTHER, modified: false }),
    ]);
    const multi = (
      await grouped([OTHER, 'default'], { with_meanings: true, translation_languages: ['ru'] }).expect(200)
    ).body as PublicSearchDatasetsV1ResT;
    expect(multi.data.map((g) => g.dataset)).toEqual(['default', OTHER]);
    const [first, second] = multi.data;
    if (first.status !== 'ok' || second.status !== 'ok') throw new Error('expected both datasets');
    const a = first.data.find((w) => w.word === 'amber')!;
    const b = second.data.find((w) => w.word === 'amber')!;
    expect(a.id).toBe(b.id);
    expect(a).toMatchObject({ source: 'vocab-bloom-hub', modified: true, description: 'default' });
    expect(b).toMatchObject({ source: OTHER, modified: false, description: OTHER });
    expect(b.meanings[0].definition).toBe(OTHER);
    expect(b.meanings[0].translations.map((t) => t.language)).toEqual(['ru']);
    expect(second.data.map((w) => w.word)).toContain('Amber');
    expect(datasets.getActive().name).toBe('default');
  });

  pg('applies filters, fuzzy tiers and independent paging inside selected dictionaries', async () => {
    const filtered = await grouped(['default', OTHER], { type: 'phrase' }).expect(200);
    expect(filtered.body.data.every((g: { data: unknown[] }) => g.data.length === 0)).toBe(true);
    const typo = await request(server())
      .get(`/api/v1/search/detailed?search=recieve&dataset=${OTHER}`)
      .expect(200);
    expect(typo.body.meta.fuzzy).toBe(true);
    expect(typo.body.data[0]).toMatchObject({ word: 'receive', source: OTHER, similarity: expect.any(Number) });
    const one = await grouped(['default', OTHER], { limit: 1 }).expect(200);
    const two = await grouped(['default', OTHER], { limit: 1, page: 2 }).expect(200);
    for (let i = 0; i < 2; i++) {
      expect(one.body.data[i].meta.has_more).toBe(true);
      expect(two.body.data[i].meta.page).toBe(2);
      expect(two.body.data[i].data[0].id).not.toBe(one.body.data[i].data[0].id);
    }
    const short = await grouped([OTHER], { search: 'am' }).expect(200);
    expect(short.body.data[0].meta.short_term).toBe(true);
  });

  pg('invalidates selected content and visibility, and does not open unselected readers', async () => {
    const reader = jest.spyOn(datasets, 'reader');
    const previous = await grouped([OTHER]).expect(200);
    expect(reader.mock.calls.every(([dataset]) => dataset.name === OTHER)).toBe(true);
    await add('amberstone', OTHER);
    const edited = await grouped([OTHER]).set('If-None-Match', previous.headers.etag).expect(200);
    expect(edited.headers.etag).not.toBe(previous.headers.etag);
    const inventory = await request(server()).get('/api/v1/datasets').expect(200);
    await datasets.setVisibility(OTHER, false);
    await grouped([OTHER]).set('If-None-Match', edited.headers.etag).expect(404);
    const closed = await request(server())
      .get('/api/v1/datasets')
      .set('If-None-Match', inventory.headers.etag)
      .expect(200);
    expect(closed.body.data.map((d: { dataset: string }) => d.dataset)).toEqual(['default']);
    await datasets.setVisibility(OTHER, true);
  });

  pg('returns successful groups alongside failures without falling back to active content', async () => {
    const reader = datasets.reader.bind(datasets);
    jest
      .spyOn(datasets, 'reader')
      .mockImplementation((dataset) =>
        dataset.name === OTHER ? Promise.reject(new Error('offline')) : reader(dataset),
      );
    const response = await grouped(['default', OTHER]).expect(200);
    expect(response.body.data[0]).toMatchObject({ status: 'ok', data: expect.any(Array) });
    expect(response.body.data[1]).toMatchObject({ dataset: OTHER, status: 'unavailable' });
    expect(response.body.data[1]).not.toHaveProperty('data');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  pg('charges one shared budget unit per group before doing any search work', async () => {
    process.env.PUBLIC_API_RATE_LIMIT = '5/60';
    const ip = '192.0.2.52';
    const first = await grouped(['default', OTHER]).set('X-Forwarded-For', ip).expect(200);
    expect(first.headers['x-ratelimit-remaining']).toBe('3');
    await request(server()).get('/api/v1/meta').set('X-Forwarded-For', ip).expect(200);
    const flat = await request(server())
      .get('/api/v1/search?search=amber')
      .set('X-Forwarded-For', ip)
      .expect(200);
    expect(flat.headers['x-ratelimit-remaining']).toBe('1');
    const search = jest.spyOn(app.get(EnSearchService), 'searchDetailed');
    await grouped(['default', OTHER]).set('X-Forwarded-For', ip).expect(429);
    expect(search).not.toHaveBeenCalled();
  });
});
