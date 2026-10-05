export type MorphologyT = { pos: string } & Partial<
  Record<
    | 'plural'
    | 'past_tense'
    | 'past_participle'
    | 'present_participle'
    | 'third_person_singular'
    | 'comparative'
    | 'superlative',
    string | null
  >
>;
export type LexemeT = {
  lexeme_id: string;
  headword: string;
  language: string;
  kind: string;
  source: string;
  retired: boolean;
  sense_ids: string[];
  morphology: MorphologyT[];
  provenance_summary: { models: string[] };
};
export type SenseT = {
  lexeme_id: string;
  sense_id: string;
  headword: string;
  pos: string;
  source: string;
  gloss: string;
  examples: { text: string; reading_level: string; register: string }[];
  relations: { type: string; target_term: string; target_sense_id: string | null }[];
};
