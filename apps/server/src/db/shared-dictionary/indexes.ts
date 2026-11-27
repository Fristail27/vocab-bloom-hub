import type { QueryRunner } from 'typeorm';
import { type DictionaryTable, sharedTable } from './tables';

// These are the access paths from the lexical reader, word-row loader,
// editorial queues and reconciliation. Leading dataset_id also serves
// deletion and counts by owner. The GIN indexes can be bitmap-combined.
const indexes: Partial<Record<DictionaryTable, string[]>> = {
  en_entries: ['type', 'lower(word) COLLATE "C"'],
  en_words: [
    'word, part_of_speech, form_of_word',
    '"baseFormId"',
    '"basePhrasalId", part_of_speech, form_of_word',
    'lower(word) COLLATE "C", id',
    'part_of_speech',
    'form_of_word',
    'word_level',
    'area_variant',
    'language_register',
  ],
  en_entry_alternatives: ['alternative'],
  en_meanings: ['word, sort_order', 'etymology_id', 'sync_id'],
  en_meanings_translations: ['meaning', 'language'],
  en_short_translations: ['word', 'language'],
  en_meaning_synonyms: ['word'],
  en_meaning_antonyms: ['word'],
  en_meaning_embeddings: ['meaning_id'],
  en_changes: ['headword'],
  reconciliation_items: ['plan, category, headword'],
  suggestions: ['headword', 'status', 'word_id'],
};

export async function createDictionaryIndexes(runner: QueryRunner): Promise<void> {
  for (const [table, expressions] of Object.entries(indexes)) {
    for (const expression of expressions) {
      await runner.query(
        `CREATE INDEX ON ${sharedTable(table as DictionaryTable)} (dataset_id, ${expression})`,
      );
    }
  }
  await runner.query(`CREATE UNIQUE INDEX ON ${sharedTable('en_etymologies')} (dataset_id, word, number)`);
  await runner.query(`CREATE INDEX ON ${sharedTable('en_pronunciations')} (dataset_id, word, sort_order)`);
  await runner.query(
    `CREATE INDEX ON ${sharedTable('en_pronunciation_audio')} (dataset_id, pronunciation, sort_order)`,
  );
  await runner.query(`CREATE INDEX ON ${sharedTable('en_entries')} USING gin (word gin_trgm_ops)`);
  await runner.query(`CREATE INDEX ON ${sharedTable('en_words')} USING gin (categories)`);
}
