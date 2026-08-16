export enum EnDictionaryImportPhasesE {
  saving_words,
  saving_phrasal_verbs,
  saving_grammar_patterns,
  saving_phrases,
  downloading_database,
  completed,
  packing_archive,
}

export const SYSTEM_FIELDS = ['id', 'createdAt', 'updateAt', 'updatedAt'];

export const DATASET_FILE_NAMES = {
  words: 'vocab-bloom-hub-en-words.jsonl',
  phrasalVerbs: 'vocab-bloom-hub-en-phrasal-verbs.jsonl',
  grammarPatterns: 'vocab-bloom-hub-en-grammar-patterns.jsonl',
  phrases: 'vocab-bloom-hub-en-phrases.jsonl',
} as const;

export const MANIFEST_FILE_NAME = 'manifest.json';

// Snapshot of the last dataset published without a manifest.json; used only
// as the progress total when the manifest is missing (legacy datasets)
export const LEGACY_DATASET_TOTAL_LINES = 87074 + 912 + 28560 + 28;

// Settings key holding the dataset version of the last successful import
export const DATASET_VERSION_SETTINGS_FIELD = 'en_dataset_version';
