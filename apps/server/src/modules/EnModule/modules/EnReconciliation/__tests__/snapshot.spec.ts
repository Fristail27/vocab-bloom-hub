import { DataSource } from 'typeorm';
import { DICTIONARY_ENTITIES } from '../../../entities/dictionary-entities';
import { EnEntry } from '../../../entities/en_entry.entity';
import { EnWord } from '../../../entities/en_word.entity';
import { EnMeaning } from '../../../entities/en_meaning.entity';
import { EnAreaVariantsE, EnPartOfSpeechE, EnWordFormsE } from '../../../../../../types';
import { alignUnchangedRecords, dictionaryRecords } from '../snapshot';
import { contentHash } from '../compare';
import type { SnapshotRecordT } from '../store';

describe('portable dictionary snapshots', () => {
  let db: DataSource;
  beforeEach(async () => {
    db = await new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: DICTIONARY_ENTITIES,
      synchronize: true,
    }).initialize();
  });
  afterEach(async () => {
    await db.destroy();
  });

  async function snapshot() {
    return db.transaction(async (em) => {
      const records: SnapshotRecordT[] = [];
      for await (const record of dictionaryRecords(em)) records.push(record);
      return records;
    });
  }

  it('retains meaning identity across edits and never reuses a deleted row identity', async () => {
    const entry = await db.manager.save(EnEntry, { word: 'test' });
    const word = await db.manager.save(EnWord, {
      word: entry,
      part_of_speech: EnPartOfSpeechE.noun,
      form_of_word: EnWordFormsE.base_form,
      generated: false,
    });
    const meaning = await db.manager.save(EnMeaning, {
      word,
      title: 'first',
      definition: 'original',
      sort_order: 0,
      is_obsolete: false,
      area_variant: EnAreaVariantsE.common,
      examples: [],
    });
    const first = await snapshot();
    const identified = await db.manager.findOneByOrFail(EnMeaning, { id: meaning.id });
    expect(identified.sync_id).toMatch(/^[\da-f-]{36}$/);
    expect((await snapshot()).map((row) => contentHash(row.content))).toEqual(
      first.map((row) => contentHash(row.content)),
    );
    await db.manager.update(
      EnMeaning,
      { id: meaning.id },
      { title: 'renamed', definition: 'edited', sort_order: 2 },
    );
    const second = await snapshot();
    expect(JSON.stringify(second)).toContain(identified.sync_id!);
    expect(JSON.stringify(second)).toContain('edited');
    await db.manager.delete(EnMeaning, { id: meaning.id });
    await db.manager.save(EnMeaning, { ...meaning, id: meaning.id, title: 'new', sync_id: null });
    await snapshot();
    expect((await db.manager.findOneByOrFail(EnMeaning, { id: meaning.id })).sync_id).not.toBe(
      identified.sync_id,
    );
  });

  it('matches only unchanged unambiguous records when incoming IDs are foreign', () => {
    expect(
      alignUnchangedRecords(
        { a: { text: 'same' }, b: { text: 'before' } },
        { foreign: { text: 'same' }, new: { text: 'after' } },
      ),
    ).toEqual({ a: { text: 'same' }, new: { text: 'after' } });
    expect(
      alignUnchangedRecords({ a: { text: 'same' }, b: { text: 'same' } }, { foreign: { text: 'same' } }),
    ).toEqual({ foreign: { text: 'same' } });
  });
});
