/**
 * A running instance for the SDK test suites (issue #276): the application
 * on an in-memory SQLite database, listening on an ephemeral port, seeded
 * with a handful of entries through the admin API. Prints
 * `LISTENING <url>` once ready and serves until SIGTERM / SIGINT / stdin
 * closes. The seed mirrors the npm-sdk live test so both SDKs assert the
 * same dictionary.
 *
 *   yarn workspace server fixture:public-api
 */
process.env.DATABASE_URL = 'sqlite::memory:';
// the fixture seeds its own words; the first-start import must stay off
process.env.DICTIONARY_AUTO_IMPORT = 'false';
process.env.ADMIN_USERNAME ??= 'fixture-admin';
process.env.ADMIN_PASSWORD ??= 'fixture-password';

import http from 'node:http';
import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/modules/AppModule/app.module';
import { AllExceptionsFilter } from '../../src/core/filters/all-exceptions.filter';
import { PublicOpenApiService } from '../../src/modules/PublicApiModule/public-openapi.service';
import { createJwt } from '../../core/utils/auth';
import { hashLoginString } from '../../core/utils/crypto';

// one connection per request: the same keep-alive race as in the test suites
http.globalAgent = new http.Agent({ keepAlive: false });

const meaning = (title: string, extra: object = {}) => ({
  title,
  definition: `definition of ${title}`,
  is_obsolete: false,
  sort_order: 1,
  examples: [],
  area_variant: 'common',
  translations: [],
  ...extra,
});

export const FIXTURE_WORDS: object[] = [
  { word: 'sprint', part_of_speech: 'verb', form_of_word: 'base_form', meanings: [meaning('to run fast')] },
  {
    word: 'run',
    part_of_speech: 'verb',
    form_of_word: 'base_form',
    word_level: 'A1',
    transcription: '/rʌn/',
    forms: [{ word: 'ran', form_of_word: 'past_simple', area_variant: 'common' }],
    meanings: [
      meaning('to move fast', {
        examples: ['He runs every morning.'],
        translations: [
          { language: 'ru', title: 'бежать', definition: 'бежать (definition)', variants_of_words: ['бежать'] },
        ],
        synonyms: ['sprint'],
      }),
    ],
    short_translations: [{ language: 'ru', description: 'бежать', variants_of_words: ['бежать'] }],
  },
  {
    word: 'abandon',
    part_of_speech: 'verb',
    form_of_word: 'base_form',
    word_level: 'C1',
    meanings: [meaning('to leave')],
  },
];

const main = async () => {
  const username = process.env.ADMIN_USERNAME as string;
  const password = process.env.ADMIN_PASSWORD as string;
  const hashByEnv = await hashLoginString(username, password);
  const secretHash = await hashLoginString(username, hashByEnv);
  const token = createJwt({ role: 'admin' }, secretHash + hashByEnv);

  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost).httpAdapter));
  await app.listen(0, '127.0.0.1');
  app.get(PublicOpenApiService).attach(app);
  const url = await app.getUrl();

  for (const word of FIXTURE_WORDS) {
    const res = await fetch(`${url}/api/en/add/word`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(word),
    });
    if (res.status !== 201) throw new Error(`seed failed: ${res.status} ${await res.text()}`);
  }

  const stop = async () => {
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void stop());
  process.on('SIGINT', () => void stop());
  process.stdin.on('end', () => void stop());
  process.stdin.resume();

  console.log(`LISTENING ${url}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
