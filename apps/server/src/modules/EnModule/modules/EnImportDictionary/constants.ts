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
