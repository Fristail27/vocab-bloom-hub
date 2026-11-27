// Legacy names and local keys at the storage boundary. The first component of
// every new key is the registry ID. Portable IDs can repeat across forks.
export const dictionaryKeys = {
  en_entries: 'word',
  en_words: 'id',
  en_etymologies: 'id',
  en_meanings: 'id',
  en_meanings_translations: 'id',
  en_short_translations: 'id',
  en_pronunciations: 'id',
  en_pronunciation_audio: 'id',
  en_entry_alternatives: 'word, alternative',
  en_meaning_synonyms: 'meaning_id, word',
  en_meaning_antonyms: 'meaning_id, word',
  suggestions: 'id',
  en_changes: 'id',
  en_content_reviews: 'scope, identity',
  en_embedding_profiles: 'id',
  en_meaning_embeddings: 'profile_id, meaning_id',
  reconciliation_identity: 'key',
  reconciliation_revisions: 'id',
  reconciliation_records: 'revision, headword',
  reconciliation_baselines: 'lineage',
  reconciliation_plans: 'id',
  reconciliation_items: 'plan, headword',
  reconciliation_embeddings: 'plan, profile_id, ordinal',
} as const;
export type DictionaryTable = keyof typeof dictionaryKeys;
export const dictionaryTables = Object.keys(dictionaryKeys) as DictionaryTable[];
export const sharedTable = (name: DictionaryTable): string => `public."dictionary_${name}"`;

// History and proposals intentionally retain snapshots after a target is
// removed. Apply FK actions only to the live relations in the legacy graph.
export const dictionaryRelations: ReadonlyArray<[DictionaryTable, string, DictionaryTable, string, string]> = [
  // Native synchronization archives can order rows independently of parents.
  // Validate the assembled graph at commit, after the importer's own checks.
  [
    'reconciliation_records',
    'revision',
    'reconciliation_revisions',
    'id',
    'ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED',
  ],
  ['reconciliation_baselines', 'revision', 'reconciliation_revisions', 'id', 'DEFERRABLE INITIALLY DEFERRED'],
  ['reconciliation_plans', 'local', 'reconciliation_revisions', 'id', 'DEFERRABLE INITIALLY DEFERRED'],
  ['reconciliation_plans', 'incoming', 'reconciliation_revisions', 'id', 'DEFERRABLE INITIALLY DEFERRED'],
  ['reconciliation_plans', 'baseline', 'reconciliation_revisions', 'id', 'DEFERRABLE INITIALLY DEFERRED'],
  [
    'reconciliation_items',
    'plan',
    'reconciliation_plans',
    'id',
    'ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED',
  ],
  [
    'reconciliation_embeddings',
    'plan',
    'reconciliation_plans',
    'id',
    'ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED',
  ],
  ['en_words', 'word', 'en_entries', 'word', 'ON DELETE CASCADE'],
  ['en_words', '"baseFormId"', 'en_words', 'id', 'ON DELETE SET NULL'],
  ['en_words', '"basePhrasalId"', 'en_words', 'id', 'ON DELETE SET NULL'],
  ['en_meanings', 'word', 'en_words', 'id', 'ON DELETE CASCADE'],
  ['en_meanings', 'etymology_id', 'en_etymologies', 'id', 'ON DELETE SET NULL'],
  ['en_etymologies', 'word', 'en_words', 'id', 'ON DELETE CASCADE'],
  ['en_pronunciations', 'word', 'en_words', 'id', 'ON DELETE CASCADE'],
  ['en_pronunciation_audio', 'pronunciation', 'en_pronunciations', 'id', 'ON DELETE CASCADE'],
  ['en_meanings_translations', 'meaning', 'en_meanings', 'id', 'ON DELETE CASCADE'],
  ['en_short_translations', 'word', 'en_words', 'id', 'ON DELETE CASCADE'],
  ['en_entry_alternatives', 'word', 'en_entries', 'word', 'ON DELETE CASCADE ON UPDATE CASCADE'],
  ['en_entry_alternatives', 'alternative', 'en_entries', 'word', 'ON DELETE CASCADE ON UPDATE CASCADE'],
  ['en_meaning_synonyms', 'meaning_id', 'en_meanings', 'id', 'ON DELETE CASCADE ON UPDATE CASCADE'],
  ['en_meaning_synonyms', 'word', 'en_entries', 'word', 'ON DELETE CASCADE ON UPDATE CASCADE'],
  ['en_meaning_antonyms', 'meaning_id', 'en_meanings', 'id', 'ON DELETE CASCADE ON UPDATE CASCADE'],
  ['en_meaning_antonyms', 'word', 'en_entries', 'word', 'ON DELETE CASCADE ON UPDATE CASCADE'],
  ['suggestions', 'word_id', 'en_words', 'id', 'ON DELETE SET NULL'],
  ['en_meaning_embeddings', 'meaning_id', 'en_meanings', 'id', 'ON DELETE CASCADE'],
  [
    'en_meaning_embeddings',
    'profile_id, dimensions',
    'en_embedding_profiles',
    'id, dimensions',
    'ON DELETE CASCADE',
  ],
];

export const serialTables: ReadonlySet<DictionaryTable> = new Set<DictionaryTable>([
  'en_words',
  'en_etymologies',
  'en_meanings',
  'en_meanings_translations',
  'en_short_translations',
  'en_pronunciations',
  'en_pronunciation_audio',
  'suggestions',
  'en_changes',
]);
