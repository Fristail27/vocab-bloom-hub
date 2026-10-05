import { mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import { zstdCompressSync } from 'node:zlib';
import type { SchemaElement } from 'hyparquet';
import { parquetWriteFile } from 'hyparquet-writer';
import { OPENGLOSS_FILES } from '../../../core/constants/opengloss';

// Authored for these tests; no definitions or examples copied from OpenGloss.
export const openGlossFixtureRows = () => {
  const common = { lexeme_id: 'glimmer', headword: 'glimmer', source: 'opengloss-v1.3' };
  const example = { text: 'The test robot found a glimmer.', reading_level: 'neutral', register: 'plain' };
  const sense = {
    ...common,
    sense_id: 'glimmer:noun:0',
    pos: 'noun',
    gloss: 'A tiny invented signal in this test.',
    examples: [example, example, { ...example, text: 'A rewritten example.', reading_level: 'grade_1' }],
    relations: [
      { type: 'synonym', target_term: 'Northstar', target_sense_id: 'northstar:noun:0' },
      { type: 'antonym', target_term: 'flash', target_sense_id: 'flash:verb:0' },
    ],
  };
  const lexeme = {
    ...common,
    language: 'en',
    kind: 'simplex',
    retired: false,
    sense_ids: ['glimmer:noun:0', 'glimmer:noun:1', 'glimmer:verb:0'],
    morphology: [
      { pos: 'noun', plural: 'glimmers' },
      {
        pos: 'verb',
        past_tense: 'glimmered',
        past_participle: 'glimmered',
        present_participle: 'glimmering',
        third_person_singular: 'glimmers',
      },
    ],
    provenance_summary: { models: ['fixture-model'] },
  };
  const senses = [
    sense,
    { ...sense, sense_id: 'glimmer:noun:1', gloss: 'A second invented test signal.' },
    { ...sense, sense_id: 'glimmer:verb:0', pos: 'verb' },
    {
      ...sense,
      lexeme_id: 'northstar',
      headword: 'Northstar',
      sense_id: 'northstar:noun:0',
      source: 'wordnet-3.0',
      gloss: 'The fictional name of a test vehicle.',
    },
  ];
  const lexicon = [
    lexeme,
    { ...lexeme, lexeme_id: 'hush', headword: 'hush', retired: true, sense_ids: [] },
    {
      ...lexeme,
      lexeme_id: 'northstar',
      headword: 'Northstar',
      source: 'wordnet-3.0',
      kind: 'proper_noun',
      sense_ids: ['northstar:noun:0'],
      morphology: [{ pos: 'noun', plural: 'Northstars' }],
      provenance_summary: { models: ['fixture-model', 'wordnet-3.0', 'rule:reciprocity'] },
    },
  ];
  return { senses, lexicon };
};

/** Shared paradigms as published by OpenGloss; all definitions are authored here. */
export const openGlossInflectionFixtureRows = () => {
  const template = openGlossFixtureRows();
  const rows: typeof template = { senses: [], lexicon: [] };
  for (const [word, parts] of [
    ['ran', ['verb']],
    ['run', ['noun', 'verb']],
    ['running', ['adjective', 'noun', 'verb']],
    ['runs', ['noun', 'verb']],
  ] as const) {
    const senses = parts.map((pos) => ({
      ...template.senses[0],
      lexeme_id: word,
      headword: word,
      sense_id: `${word}:${pos}:0`,
      pos,
      gloss: `An invented ${pos} definition filed under ${word}.`,
      examples: [{ text: `A test example for ${word}.`, reading_level: 'neutral', register: 'plain' }],
      relations: [],
    }));
    rows.senses.push(...senses);
    rows.lexicon.push({
      ...template.lexicon[0],
      lexeme_id: word,
      headword: word,
      sense_ids: senses.map((sense) => sense.sense_id),
      morphology: [
        {
          pos: 'verb',
          past_tense: 'ran',
          past_participle: 'run',
          present_participle: 'running',
          third_person_singular: 'runs',
        },
      ],
    });
  }
  return rows;
};

const string = (name: string): SchemaElement => ({
  name,
  type: 'BYTE_ARRAY',
  converted_type: 'UTF8',
  repetition_type: 'OPTIONAL',
});
const structure = (name: string, fields: string[]): SchemaElement[] => [
  { name, num_children: fields.length, repetition_type: 'OPTIONAL' },
  ...fields.map(string),
];
const list = (name: string, element: SchemaElement[]): SchemaElement[] => [
  { name, converted_type: 'LIST', repetition_type: 'OPTIONAL', num_children: 1 },
  { name: 'list', repetition_type: 'REPEATED', num_children: 1 },
  ...element,
];
const schemas: Record<'senses' | 'lexicon', SchemaElement[]> = {
  senses: [
    { name: 'root', num_children: 8 },
    ...['lexeme_id', 'headword', 'source', 'sense_id', 'pos', 'gloss'].map(string),
    ...list('examples', structure('element', ['text', 'reading_level', 'register'])),
    ...list('relations', structure('element', ['type', 'target_term', 'target_sense_id'])),
  ],
  lexicon: [
    { name: 'root', num_children: 10 },
    ...['lexeme_id', 'headword', 'source', 'language', 'kind'].map(string),
    { name: 'retired', type: 'BOOLEAN', repetition_type: 'REQUIRED' },
    ...list('sense_ids', [string('element')]),
    ...list(
      'morphology',
      structure('element', [
        'pos',
        'plural',
        'past_tense',
        'past_participle',
        'present_participle',
        'third_person_singular',
        'comparative',
        'superlative',
      ]),
    ),
    { name: 'provenance_summary', num_children: 1, repetition_type: 'OPTIONAL' },
    ...list('models', [string('element')]),
    string('unused'),
  ],
};

export const writeOpenGlossFixture = async (
  dir: string,
  rows = openGlossFixtureRows(),
): Promise<Record<string, string>> => {
  await mkdir(path.join(dir, 'senses'), { recursive: true });
  await mkdir(path.join(dir, 'lexicon'), { recursive: true });
  const files: Record<string, string> = {};
  for (const file of OPENGLOSS_FILES) {
    const index = Number(file.file_name.match(/\d+/)![0]);
    const data: Record<string, unknown>[] = rows[file.table].slice(index, index === 2 ? undefined : index + 1);
    const names = Object.keys(rows[file.table][0]);
    if (file.table === 'lexicon') names.push('unused');
    const filename = path.join(dir, file.table, file.file_name);
    parquetWriteFile({
      filename,
      schema: schemas[file.table],
      columnData: names.map((name) => ({ name, data: data.map((row) => row[name] ?? null) })),
      codec: 'ZSTD',
      compressors: { ZSTD: zstdCompressSync },
      rowGroupSize: 1,
    });
    files[file.field] = filename;
  }
  return files;
};
