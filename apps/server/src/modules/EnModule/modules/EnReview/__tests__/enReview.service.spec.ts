import { DataSource } from 'typeorm';
import { EnReviewService } from '../enReview.service';
import { DICTIONARY_ENTITIES } from '../../../entities/dictionary-entities';
import { EnEntry } from '../../../entities/en_entry.entity';
import { EnWord } from '../../../entities/en_word.entity';
import { EnMeaning } from '../../../entities/en_meaning.entity';
import { EnMeaningTranslation } from '../../../entities/en_meaning_translation.entity';
import { EnShortTranslation } from '../../../entities/en_short_translation.entity';
import { EnChange } from '../../../entities/en_change.entity';
import { EnContentReview } from '../../../entities/en_content_review.entity';
import { AvailableTranslationLanguagesE, EnPartOfSpeechE, EnWordFormsE } from '../../../../../../types';
import { ReviewScopeE as Scope, ReviewStatusE as Status } from '../../../../../../types/reviews';
import { withDatasetScope } from '../../../../../core/utils/dataset-scope';

const database = () =>
  new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: DICTIONARY_ENTITIES,
    synchronize: true,
  }).initialize();
async function fixture(db: DataSource) {
  const entry = await db.manager.save(EnEntry, { word: 'bird', user_modified: false });
  const word = await db.manager.save(EnWord, {
    word: entry,
    part_of_speech: EnPartOfSpeechE.noun,
    form_of_word: EnWordFormsE.base_form,
    generated: true,
    version: '1',
  });
  const meaning = await db.manager.save(EnMeaning, {
    word,
    title: 'bird',
    definition: 'a feathered animal',
    sort_order: 1,
  });
  const translation = await db.manager.save(EnMeaningTranslation, {
    meaning,
    language: AvailableTranslationLanguagesE.ru,
    title: 'птица',
    definition: 'животное с перьями',
    variants_of_words: ['птица'],
  });
  const short = await db.manager.save(EnShortTranslation, {
    word,
    language: AvailableTranslationLanguagesE.ru,
    description: 'птица',
    variants_of_words: ['птица'],
  });
  return { word, meaning, translation, short };
}

describe('local content review', () => {
  let db: DataSource, service: EnReviewService, data: Awaited<ReturnType<typeof fixture>>;
  beforeEach(async () => {
    db = await database();
    service = new EnReviewService(db);
    data = await fixture(db);
  });
  afterEach(async () => {
    await db.destroy();
  });
  const states = () => service.word(data.word.id);
  const mark = async (scope: Scope) => {
    const row = (await states()).find((r) => r.scope === scope)!;
    return service.set(scope, row.id, { checked: true, expected: row.expected });
  };

  it('starts unchecked, marks each scope independently, counts portions and clears marks', async () => {
    expect((await states()).map((r) => r.status)).toEqual([
      Status.unchecked,
      Status.unchecked,
      Status.unchecked,
    ]);
    const checked = await mark(Scope.definition);
    expect(checked).toMatchObject({ status: Status.checked, checked_at: expect.any(String) });
    expect((await states()).map((r) => r.status)).toEqual([Status.checked, Status.unchecked, Status.unchecked]);
    await mark(Scope.meaning_translation);
    await mark(Scope.short_translation);
    const listing = await service.words({
      scope: Scope.definition,
      status: Status.checked,
      search: 'bi',
      limit: 1,
    });
    expect(listing).toMatchObject({
      total: 1,
      counts: { checked: 1, changed: 0, unchecked: 0 },
      items: [{ word: 'bird', matches: 1 }],
    });
    expect((await service.words({ scope: Scope.definition, status: Status.unchecked })).items).toEqual([]);
    await service.set(Scope.definition, data.meaning.id, { checked: false, expected: checked.expected });
    expect((await states())[0].status).toBe(Status.unchecked);
  });

  it('does not edit content, version, modified flags, timestamps, provenance or history', async () => {
    const wordBefore = await db.manager.findOneByOrFail(EnWord, { id: data.word.id });
    const entryBefore = await db.manager.findOneByOrFail(EnEntry, { word: 'bird' });
    const meaningBefore = await db.manager.findOneByOrFail(EnMeaning, { id: data.meaning.id });
    await mark(Scope.definition);
    const meaningAfter = await db.manager.findOneByOrFail(EnMeaning, { id: data.meaning.id });
    expect(meaningAfter).toEqual({ ...meaningBefore, sync_id: expect.any(String) });
    expect(await db.manager.findOneByOrFail(EnWord, { id: data.word.id })).toEqual(wordBefore);
    expect(await db.manager.findOneByOrFail(EnEntry, { word: 'bird' })).toEqual(entryBefore);
    expect(await db.manager.count(EnChange)).toBe(0);
  });

  it('ignores unchanged saves, versions and unrelated fields; compares reverted content', async () => {
    await mark(Scope.definition);
    await mark(Scope.meaning_translation);
    await mark(Scope.short_translation);
    await db.manager.update(EnWord, data.word.id, { version: '2', transcription: '/bird/' });
    await db.manager.update(EnMeaning, data.meaning.id, {
      definition: data.meaning.definition,
      examples: ['A bird flies.'],
    });
    expect((await states()).every((r) => r.status === Status.checked)).toBe(true);
    await db.manager.update(EnMeaningTranslation, data.translation.id, { definition: 'new translation' });
    expect((await states()).map((r) => r.status)).toEqual([Status.checked, Status.changed, Status.checked]);
    await db.manager.update(EnMeaningTranslation, data.translation.id, {
      definition: data.translation.definition,
    });
    expect((await states())[1].status).toBe(Status.checked);
    await db.manager.update(EnMeaning, data.meaning.id, { definition: 'another meaning' });
    expect((await states()).map((r) => r.status)).toEqual([Status.changed, Status.changed, Status.checked]);
    expect((await service.words({ scope: Scope.definition, status: Status.changed })).counts.changed).toBe(1);
    await mark(Scope.definition);
    expect((await states())[0].status).toBe(Status.checked);
  });

  it('rejects confirmation of content that changed after it was displayed', async () => {
    const before = (await states())[0];
    await db.manager.update(EnMeaning, data.meaning.id, { definition: 'edited elsewhere' });
    await expect(
      service.set(Scope.definition, data.meaning.id, { checked: true, expected: before.expected }),
    ).rejects.toThrow('review_content_changed');
    expect(await db.manager.count(EnContentReview)).toBe(0);
    await expect(service.set(Scope.definition, -1, { checked: true, expected: '' })).rejects.toThrow(
      'review_target_not_found',
    );
    await expect(service.word(-1)).rejects.toThrow();
  });

  it('survives a reconciliation rewrite with the same identity, but never trusts reused numeric IDs', async () => {
    await mark(Scope.definition);
    const previous = await db.manager.findOneByOrFail(EnMeaning, { id: data.meaning.id });
    await db.manager.delete(EnMeaning, previous.id);
    const { id: _id, ...content } = previous;
    const replacement = await db.manager.save(EnMeaning, { ...content, word: data.word, id: 100 });
    expect((await states()).find((r) => r.id === replacement.id)?.status).toBe(Status.checked);
    await db.manager.update(EnMeaning, replacement.id, { definition: 'source update' });
    expect((await states()).find((r) => r.id === replacement.id)?.status).toBe(Status.changed);
    await db.manager.delete(EnMeaning, replacement.id);
    await db.manager.save(EnMeaning, { ...content, id: previous.id, sync_id: null, word: data.word });
    expect((await states()).find((r) => r.scope === Scope.definition)?.status).toBe(Status.unchecked);
  });

  it('isolates the edited dataset even when its rows have the same IDs', async () => {
    const other = await database();
    try {
      await fixture(other);
      await withDatasetScope(
        { dataset: { name: 'other', source: 'other', own: true }, dataSource: other },
        () => mark(Scope.definition),
      );
      expect((await states())[0].status).toBe(Status.unchecked);
      expect(await other.manager.count(EnContentReview)).toBe(1);
      const runner = other.createQueryRunner();
      await runner.startTransaction();
      await withDatasetScope(
        { dataset: { name: 'other', source: 'other', own: true }, dataSource: db, manager: runner.manager },
        () => service.set(Scope.definition, data.meaning.id, { checked: false, expected: '' }),
      );
      await runner.rollbackTransaction();
      await runner.release();
      expect(await other.manager.count(EnContentReview)).toBe(1);
    } finally {
      await other.destroy();
    }
  });

  it('does not count orphaned notes, distinguishes punctuation, and paginates distinct words', async () => {
    await mark(Scope.definition);
    await db.manager.update(EnMeaning, data.meaning.id, { title: 'bi:rd', definition: 'a feathered animal' });
    expect((await states())[0].status).toBe(Status.changed);
    await db.manager.delete(EnMeaning, data.meaning.id);
    expect(await service.words({ scope: Scope.definition })).toMatchObject({
      total: 0,
      counts: { unchecked: 0, checked: 0, changed: 0 },
    });
    expect(await service.words({ scope: Scope.short_translation, page: 2, limit: 1 })).toMatchObject({
      total: 1,
      items: [],
    });
    expect((await service.words({ scope: Scope.short_translation, search: '%' })).total).toBe(0);
  });
});
