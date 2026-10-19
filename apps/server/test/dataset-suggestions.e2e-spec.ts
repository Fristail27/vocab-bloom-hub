import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import type { Express } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { checkIsPostgres } from '../configuration';
import { createJwt } from '../core/utils/auth';
import { hashLoginString } from '../core/utils/crypto';
import { AppModule } from '../src/modules/AppModule/app.module';
import { AllExceptionsFilter } from '../src/core/filters/all-exceptions.filter';
import { DatasetsService } from '../src/modules/DatasetsModule/datasets.service';
import { EnEntry } from '../src/modules/EnModule/entities/en_entry.entity';
import { EnWord } from '../src/modules/EnModule/entities/en_word.entity';
import { EnMeaning } from '../src/modules/EnModule/entities/en_meaning.entity';
import { EnMeaningTranslation } from '../src/modules/EnModule/entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../src/modules/EnModule/entities/en_short_translation.entity';
import { EnChange } from '../src/modules/EnModule/entities/en_change.entity';
import { Suggestion } from '../src/modules/SuggestionsModule/entities/suggestion.entity';
import { SuggestionsService } from '../src/modules/SuggestionsModule/suggestions.service';
import { MAX_OPEN_SUGGESTIONS } from '../src/modules/SuggestionsModule/constants';
import { AvailableTranslationLanguagesE, EnPartOfSpeechE, EnWordFormsE, SuggestionStatusE } from '../types';

const pg = checkIsPostgres();
const report = (extra: Record<string, unknown> = {}) => ({
  headword: 'run',
  message: 'Please check this definition.',
  ...extra,
});
const correction = (dataset: string, id: number) => ({
  headword: 'run',
  dataset,
  kind: 'edit',
  author_name: 'Reader',
  author_consent: true,
  edits: [
    { target_type: 'word', target_id: id, changes: { description: 'Corrected in the selected dataset' } },
  ],
});

describe('suggestions belong to the viewed dataset (#651)', () => {
  let app: INestApplication<App>;
  let datasets: DatasetsService;
  let active: DataSource;
  let selected: DataSource;
  let activeWord: EnWord;
  let selectedWord: EnWord;
  const auth = { Authorization: '' };
  const server = () => app.getHttpServer();
  const post = (body: object) => request(server()).post('/api/v1/suggestions').send(body);
  const seed = async (ds: DataSource, spelling: string, description: string) => {
    const word = await ds.getRepository(EnEntry).save({ word: spelling });
    return ds
      .getRepository(EnWord)
      .save({ word, description, part_of_speech: EnPartOfSpeechE.verb, form_of_word: EnWordFormsE.base_form });
  };
  const visibility = (is_public: boolean) =>
    request(server())
      .patch('/api/en/datasets/reader_words/visibility')
      .set(auth)
      .send({ is_public })
      .expect(200);

  beforeAll(async () => {
    process.env.ADMIN_USERNAME = 'e2e-admin';
    process.env.ADMIN_PASSWORD = 'e2e-password';
    process.env.SUGGESTIONS_RATE_LIMIT = '1000/60';
    const hash = await hashLoginString('e2e-admin', 'e2e-password');
    const secret = await hashLoginString('e2e-admin', hash);
    auth.Authorization = `Bearer ${createJwt({ role: 'admin' }, secret + hash)}`;
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication();
    const expressApp: Express = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', 1);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost).httpAdapter));
    await app.listen(0, '127.0.0.1');
    datasets = app.get(DatasetsService);
    active = app.get(DataSource);
    activeWord = await seed(active, 'run', 'The active definition');
    if (pg) {
      await request(server())
        .post('/api/en/datasets')
        .set(auth)
        .send({
          name: 'reader_words',
          title: 'Reader words',
          version: 'selected-v1',
          license: { spdx: 'CC0-1.0' },
          attribution: 'Selected authors',
        })
        .expect(201);
      await visibility(true);
      selected = await datasets.reader(await datasets.find('reader_words'));
      selectedWord = await seed(selected, 'run', 'The selected definition');
      expect(selectedWord.id).toBe(activeWord.id);
    }
  });

  afterAll(async () => {
    delete process.env.SUGGESTIONS_RATE_LIMIT;
    await app?.close();
  });

  it('accepts an explicit default target and preserves omitted targets, including on SQLite', async () => {
    for (const extra of [{}, { dataset: 'default', word_id: activeWord.id }]) {
      const response = await post(report(extra)).expect(201);
      expect(await active.getRepository(Suggestion).findOneBy({ id: response.body.data.id })).toMatchObject({
        headword: 'run',
      });
    }
  });

  it('rejects unknown/uninstalled targets and malformed selectors without falling back', async () => {
    for (const dataset of ['missing', 'wiktionary']) {
      const response = await post(report({ dataset })).expect(404);
      expect(response.body.message).toBe('dataset_not_found');
    }
    for (const dataset of ['', null, '../default', 5]) await post(report({ dataset })).expect(400);
  });

  it('checks a report word ID against its headword and respects exact case variants', async () => {
    const other = await seed(active, 'walk', 'another headword');
    await post(report({ word_id: other.id })).expect(404);
    const upper = await seed(active, 'Run', 'The capitalized variant');
    await post(report({ headword: 'Run', word_id: activeWord.id })).expect(404);
    await post(report({ headword: 'Run', word_id: upper.id })).expect(201);
    await post(report({ headword: 'RUN', word_id: upper.id })).expect(201);
    await post({ ...correction('default', upper.id), headword: 'RUN' }).expect(201);
  });

  (pg ? describe : describe.skip)('PostgreSQL dataset isolation', () => {
    it('stores reports and structured before-values in the inactive queue despite overlapping IDs', async () => {
      const before = await active.getRepository(Suggestion).count();
      const response = await post(report({ dataset: 'reader_words', word_id: selectedWord.id })).expect(201);
      expect(await selected.getRepository(Suggestion).findOneBy({ id: response.body.data.id })).toMatchObject({
        dataset_version: 'selected-v1',
      });
      const edit = await post(correction('reader_words', selectedWord.id)).expect(201);
      expect(await selected.getRepository(Suggestion).findOneBy({ id: edit.body.data.id })).toMatchObject({
        author_name: 'Reader',
        dataset_version: 'selected-v1',
        edits: [
          {
            target_type: 'word',
            target_id: selectedWord.id,
            changes: {
              description: { before: 'The selected definition', after: 'Corrected in the selected dataset' },
            },
          },
        ],
      });
      expect(await active.getRepository(Suggestion).count()).toBe(before);
      await visibility(false);
      await post(report({ dataset: 'reader_words' })).expect(404);
      const queue = await request(server())
        .get('/api/en/suggestions?dataset=reader_words')
        .set(auth)
        .expect(200);
      expect(JSON.stringify(queue.body)).toContain('selected-v1');
      await request(server())
        .post(`/api/en/suggestions/${edit.body.data.id}/apply?dataset=reader_words`)
        .set(auth)
        .expect(201);
      expect((await selected.getRepository(EnWord).findOneByOrFail({ id: selectedWord.id })).description).toBe(
        'Corrected in the selected dataset',
      );
      expect((await active.getRepository(EnWord).findOneByOrFail({ id: activeWord.id })).description).toBe(
        'The active definition',
      );
      const history = await selected
        .getRepository(EnChange)
        .findOneByOrFail({ suggestion_id: edit.body.data.id });
      expect(history).toMatchObject({ origin: 'suggestion', author: 'Reader' });
      expect(history.contribution).toMatchObject({ name: 'Reader words', licenses: [{ spdx: 'CC0-1.0' }] });
      await visibility(true);
    });

    it('validates every kind of target in the selected headword and never borrows active IDs', async () => {
      const other = await seed(selected, 'walk', 'Other selected word');
      const meaning = await selected
        .getRepository(EnMeaning)
        .save({ word: other, title: 'Other', definition: 'Other definition', sort_order: 1 });
      const translation = await selected.getRepository(EnMeaningTranslation).save({
        meaning,
        language: AvailableTranslationLanguagesE.ru,
        title: 'Другой',
        definition: 'Другое значение',
      });
      const short = await selected
        .getRepository(EnShortTranslation)
        .save({ word: other, language: AvailableTranslationLanguagesE.ru, description: 'другой' });
      const targets = [
        ['word', other.id, 'description'],
        ['meaning', meaning.id, 'definition'],
        ['meaning_translation', translation.id, 'definition'],
        ['short_translation', short.id, 'description'],
      ] as const;
      for (const [target_type, target_id, field] of targets) {
        await post({
          headword: 'run',
          dataset: 'reader_words',
          kind: 'edit',
          edits: [{ target_type, target_id, changes: { [field]: 'Incorrect target' } }],
        }).expect(404);
      }
      // A valid ID in the served dataset but absent in the selected one.
      const onlyActive = await seed(active, 'onlyactive', 'Active only');
      await post(report({ dataset: 'reader_words', word_id: onlyActive.id })).expect(404);
      await post({ ...correction('reader_words', selectedWord.id), author_consent: false }).expect(400);
    });

    it('caps only the selected queue and rolls back a rejected intake', async () => {
      const repo = selected.getRepository(Suggestion);
      const existing = await repo.count({ where: { status: SuggestionStatusE.new } });
      const fillers = await repo.save(
        Array.from({ length: MAX_OPEN_SUGGESTIONS - existing - 1 }, () =>
          repo.create({ headword: 'run', message: 'Queue filler' }),
        ),
      );
      const concurrent = await Promise.all([
        post(report({ dataset: 'reader_words' })),
        post(report({ dataset: 'reader_words' })),
      ]);
      expect(concurrent.map((res) => res.status).sort()).toEqual([201, 503]);
      expect(await repo.count({ where: { status: SuggestionStatusE.new } })).toBe(MAX_OPEN_SUGGESTIONS);
      await post(report()).expect(201);
      await repo.delete([
        ...fillers.map((row) => row.id),
        concurrent.find((res) => res.status === 201)!.body.data.id as number,
      ]);
    });

    it.each([undefined, 'reader_words'])(
      'pins target %s while activation waits for a submission',
      async (target) => {
        const beforeActive = await active.getRepository(Suggestion).count();
        const beforeSelected = await selected.getRepository(Suggestion).count();
        const message = `Submission before activation: ${target ?? 'omitted'}`;
        let entered!: () => void;
        let resume!: () => void;
        const started = new Promise<void>((resolve) => {
          entered = resolve;
        });
        const released = new Promise<void>((resolve) => {
          resume = resolve;
        });
        const service = app.get(SuggestionsService);
        const original = datasets.withPublicDataset.bind(datasets);
        const scope = jest.spyOn(datasets, 'withPublicDataset').mockImplementation((name, work) =>
          original(name, async (dataset) => {
            entered();
            await released;
            return work(dataset);
          }),
        );
        // HTTP intake participates in the switch gate; pause after it pins the connection.
        const submission = post(report({ dataset: target, message }))
          .expect(201)
          .then((response) => response);
        await started;
        let held!: () => void;
        const holding = new Promise<void>((resolve) => {
          held = resolve;
        });
        const gate = datasets.gate;
        const hold = gate.hold.bind(gate);
        const spy = jest.spyOn(gate, 'hold').mockImplementation((work, timeout) => {
          held();
          return hold(work, timeout);
        });
        const activation = request(server())
          .post('/api/en/datasets/reader_words/activate')
          .set(auth)
          .expect(200)
          .then((response) => response);
        try {
          await holding;
          resume();
          const response = await submission;
          await activation;
          const originalDataset = await datasets.reader(await datasets.find('default'));
          const nowActive = app.get(DataSource);
          expect(await originalDataset.getRepository(Suggestion).count()).toBe(beforeActive + (target ? 0 : 1));
          expect(await nowActive.getRepository(Suggestion).count()).toBe(beforeSelected + (target ? 1 : 0));
          const targetRepo = (target ? nowActive : originalDataset).getRepository(Suggestion);
          expect(await targetRepo.findOneBy({ id: response.body.data.id })).toMatchObject({ message });
          // Once activation has finished, omitted targets follow the newly served dataset.
          scope.mockRestore();
          const latest = await service.create(report());
          expect(
            await app.get(DataSource).getRepository(Suggestion).findOneBy({ id: latest.id }),
          ).not.toBeNull();
        } finally {
          resume();
          scope.mockRestore();
          spy.mockRestore();
          await request(server()).post('/api/en/datasets/default/activate').set(auth).expect(200);
          selected = await datasets.reader(await datasets.find('reader_words'));
        }
      },
    );

    it('shares one client rate budget across datasets and rejects a deleted target', async () => {
      process.env.SUGGESTIONS_RATE_LIMIT = '1/60';
      await post(report({ dataset: 'default' }))
        .set('X-Forwarded-For', '203.0.113.65')
        .expect(201);
      await post(report({ dataset: 'reader_words' }))
        .set('X-Forwarded-For', '203.0.113.65')
        .expect(429);
      process.env.SUGGESTIONS_RATE_LIMIT = '1000/60';
      await request(server()).delete('/api/en/datasets/reader_words').set(auth).expect(200);
      await post(report({ dataset: 'reader_words' })).expect(404);
    });
  });
});
