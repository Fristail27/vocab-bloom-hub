import { DataSource } from 'typeorm';
import { EnEntry } from '../src/modules/EnModule/entities/en_entry.entity';
import { EnWord } from '../src/modules/EnModule/entities/en_word.entity';
import { replaceAlternatives } from '../src/modules/EnModule/utils/entryAlternatives';
import { EnPartOfSpeechE, EnWordFormsE } from '../types';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/modules/AppModule/app.module';
import { DictServerService } from '../src/modules/DictModule/dict-server.service';
import { getDictConfig } from '../src/modules/DictModule/config';
import { createJwt } from '../core/utils/auth';
import { hashLoginString } from '../core/utils/crypto';
import { checkIsPostgres } from '../configuration';
import { DictClient } from './dict-client';

describe('RFC 2229 TCP against the dictionary', () => {
  let app: INestApplication<App>, listener: DictServerService, client: DictClient;
  let port: number;
  const auth = { Authorization: '' };
  const saved = process.env.DICT_ENABLED;
  beforeAll(async () => {
    process.env.DICT_ENABLED = 'false';
    process.env.ADMIN_USERNAME = 'e2e-admin';
    process.env.ADMIN_PASSWORD = 'e2e-password';
    const hash = await hashLoginString('e2e-admin', 'e2e-password');
    const secret = await hashLoginString('e2e-admin', hash);
    auth.Authorization = `Bearer ${createJwt({ role: 'admin' }, secret + hash)}`;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    for (const word of [
      'fixture',
      'fixturesque',
      'naïve phrase',
      'literal%word',
      'literalXword',
      'quoted"word',
    ]) {
      const response = await request(app.getHttpServer())
        .post('/api/en/add/word')
        .set(auth)
        .send({
          word,
          part_of_speech: 'noun',
          form_of_word: 'base_form',
          transcription: '/test/',
          ...(word === 'fixture' && {
            forms: [{ word: 'fixtures', form_of_word: 'plural_form', area_variant: 'common' }],
          }),
          meanings: [
            {
              title: 'Original fixture',
              definition: 'Original meaning\n.\nUnicode: привет 😀',
              is_obsolete: false,
              sort_order: 1,
              area_variant: 'common',
              examples: ['Original example'],
              translations: [],
            },
          ],
        });
      if (response.status !== 201) throw new Error(JSON.stringify(response.body));
    }
    const db = app.get(DataSource);
    await db.getRepository(EnEntry).save({ word: 'fyxture' });
    await replaceAlternatives(db.manager, new Map([['fixture', ['fyxture']]]));
    listener = app.get(DictServerService);
    expect(listener.address).toBeNull();
    await listener.start({ ...getDictConfig({}), enabled: true, port: 0, rateLimit: 1000 });
    port = (listener.address as AddressInfo).port;
  });
  beforeEach(async () => {
    client = new DictClient(port);
    expect(await client.line()).toMatch(/^220 Vocab Bloom Hub .* <mime> <[^<> ]+@localhost>$/);
  });
  afterEach(() => client.destroy());
  afterAll(async () => {
    await app.close();
    if (saved === undefined) delete process.env.DICT_ENABLED;
    else process.env.DICT_ENABLED = saved;
  });
  it('serves metadata, definitions, exact/prefix matches and unsupported-command errors', async () => {
    expect(await client.command('SHOW DB')).toMatch(/^110 1 databases present\r\ndefault /);
    expect(await client.command('SHOW STRAT')).toContain('exact "Case-insensitive exact spelling"');
    expect(await client.command('SHOW INFO default')).toContain('Language: en');
    const definition = await client.command('DEFINE default FIXTURE');
    expect(definition).toContain('151 "fixture" default ');
    expect(definition).toContain('Original meaning\r\n..\r\nUnicode: привет 😀');
    expect(definition).toContain('License:');
    expect(definition).toContain('Modified on this instance: yes');
    expect(await client.command('MATCH * prefix fixture')).toContain('152 3 matches found');
    expect(await client.command('MATCH * . FIXTURE')).toContain('default "fixture"');
    expect(await client.command('MATCH * prefix "literal%"')).toContain('152 1 matches found');
    expect(await client.command('MATCH missing exact fixture')).toMatch(/^550/);
    expect(await client.command('MATCH * fuzzy fixture')).toMatch(/^551/);
    expect(await client.command('DEFINE * missing')).toMatch(/^552/);
    expect(await client.command('DEFINE missing fixture')).toMatch(/^550/);
    expect(await client.command('SHOW INFO *')).toMatch(/^550/);
    expect(await client.command('AUTH name secret')).toMatch(/^502/);
  });
  it('resolves inflections and alternative-only spellings through the dataset reader', async () => {
    expect(await client.command('DEFINE default fixtures')).toContain('151 "fixture" default');
    expect(await client.command('DEFINE default fyxture')).toContain('Requested spelling: fyxture');
    expect(await client.command('MATCH default exact fyxture')).toContain('default "fyxture"');
  });
  it('handles split UTF-8, escaped quotes and pipelining with session-local MIME', async () => {
    const bytes = Buffer.from('DEFINE default "naïve phrase"\r\n');
    const split = bytes.indexOf(0xc3) + 1;
    client.socket.write(bytes.subarray(0, split));
    client.socket.write(bytes.subarray(split));
    expect(await client.response()).toContain('151 "naïve phrase"');
    expect(await client.command(String.raw`DEFINE default "quoted\"word"`)).toContain('151 "quoted\\"word"');
    client.socket.write('OPTION MIME\r\nSHOW DATABASES\r\nSHOW STRATEGIES\r\nSTATUS\r\nQUIT\r\n');
    expect(await client.response()).toMatch(/^250/);
    for (let i = 0; i < 2; i++)
      expect(await client.response()).toContain('Content-Type: text/plain; charset=utf-8');
    expect(await client.response()).toMatch(/^210/);
    expect(await client.response()).toMatch(/^221/);
  });
  (checkIsPostgres() ? it : it.skip)(
    'reads inactive datasets separately, with ordered selectors and their own terms',
    async () => {
      const http = app.getHttpServer();
      await request(http)
        .post('/api/en/datasets')
        .set(auth)
        .send({
          name: 'dict_fixture',
          title: 'Second dictionary',
          license: { spdx: 'CC0-1.0' },
          attribution: 'Second author',
        })
        .expect(201);
      await request(http)
        .post('/api/en/add/word?dataset=dict_fixture')
        .set(auth)
        .send({
          word: 'fixture',
          part_of_speech: 'verb',
          form_of_word: 'base_form',
        })
        .expect(201);
      const databases = await client.command('SHOW DB');
      expect(databases.indexOf('default ')).toBeLessThan(databases.indexOf('dict_fixture '));
      expect(await client.command('DEFINE * fixture')).toContain('150 2 definitions retrieved');
      expect(await client.command('DEFINE ! fixture')).toContain('150 1 definitions retrieved');
      const second = await client.command('DEFINE dict_fixture fixture');
      expect(second).toContain('151 "fixture" dict_fixture "Second dictionary"');
      expect(second).toContain('Second author');
      expect(second).toContain('CC0-1.0');
      expect(await client.command('MATCH * exact fixture')).toContain('152 2 matches found');
      await request(http).post('/api/en/datasets/dict_fixture/activate').set(auth).expect(200);
      try {
        expect(await client.command('DEFINE default fixture')).toContain('Original meaning');
        expect(await client.command('SHOW DB')).toBe(databases);
      } finally {
        await request(http).post('/api/en/datasets/default/activate').set(auth).expect(200);
      }
    },
  );
  it('rejects oversized match sets instead of returning partial successful results', async () => {
    const db = app.get(DataSource);
    const entries = Array.from({ length: 1001 }, (_, i) => ({ word: `limit-fixture-${i}` }));
    await db.transaction(async (manager) => {
      // TypeORM reloads inserted rows with an OR expression; keep below SQLite's expression-depth limit.
      for (let start = 0; start < entries.length; start += 100) {
        const batch = entries.slice(start, start + 100);
        await manager.getRepository(EnEntry).insert(batch);
        await manager.getRepository(EnWord).insert(
          batch.map((word) => ({
            word,
            part_of_speech: EnPartOfSpeechE.noun,
            form_of_word: EnWordFormsE.base_form,
          })),
        );
      }
    });
    expect(await client.command('MATCH default prefix limit-fixture-')).toMatch(/^420 Too many matches/);
    expect(await client.command('MATCH default exact limit-fixture-1')).toContain('152 1 matches found');
  });
  it('closes malformed UTF-8/framing and oversized commands without crashing the listener', async () => {
    expect(await client.command('x'.repeat(1023))).toMatch(/^501/);
    expect(await client.command('STATUS')).toMatch(/^210/);
    client.socket.write(Buffer.from([0xff, 13, 10]));
    expect(await client.response()).toMatch(/^501/);
    const other = new DictClient(port);
    await other.line();
    other.socket.write('HELP\n');
    expect(await other.response()).toMatch(/^501/);
    other.destroy();
    const large = new DictClient(port);
    await large.line();
    large.socket.write('a'.repeat(6145));
    expect(await large.response()).toMatch(/^420/);
    large.destroy();
  });
  it('sends 421 and closes live sockets before application shutdown closes the database', async () => {
    const stopping = app.close();
    expect(await client.response()).toMatch(/^421/);
    await stopping;
    expect(listener.address).toBeNull();
  });
});
