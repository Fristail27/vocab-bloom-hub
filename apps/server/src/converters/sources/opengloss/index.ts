import { catalogTerms, findCatalogEntry } from '../../../../core/constants/dataset_catalog';
import { datasetOrigin } from '../../../../core/utils/provenance';
import { stat } from 'node:fs/promises';
import { WORDNET_3_0_NOTICE } from '../../../../core/constants/dataset_notices';
import { EnAreaVariantsE, EnPartOfSpeechE, EnWordFormsE, OriginT } from '../../../../types';
import { emptyEntry, isRegularForm, phrasalBaseOf } from '../../normalize';
import { termsOfAdapter } from '../../terms';
import { ConvertedEntryT, ConverterContextT, HEADWORD_MAX_LENGTH, SourceAdapterT } from '../../types';
import { COLUMNS, openGlossFiles, openGlossRows, openGlossVersion } from './files';

import { LexemeT, MorphologyT, SenseT } from './types';
import { OpenGlossInflections } from './inflections';

const FORMS: [keyof Omit<MorphologyT, 'pos'>, EnWordFormsE, EnPartOfSpeechE][] = [
  ['plural', EnWordFormsE.plural_form, EnPartOfSpeechE.noun],
  ['past_tense', EnWordFormsE.past_simple, EnPartOfSpeechE.verb],
  ['past_participle', EnWordFormsE.past_participle, EnPartOfSpeechE.verb],
  ['present_participle', EnWordFormsE.present_participle, EnPartOfSpeechE.verb],
  ['third_person_singular', EnWordFormsE.third_person_singular, EnPartOfSpeechE.verb],
  ['comparative', EnWordFormsE.comparative_form, EnPartOfSpeechE.adjective],
  ['superlative', EnWordFormsE.superlative_form, EnPartOfSpeechE.adjective],
  ['comparative', EnWordFormsE.comparative_form, EnPartOfSpeechE.adverb],
  ['superlative', EnWordFormsE.superlative_form, EnPartOfSpeechE.adverb],
];
const PARTS = new Set([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'numeral',
  'determiner',
  'interjection',
  'preposition',
  'conjunction',
]);

// Some upstream strings contain broken Unicode escapes with literal NUL/C0 bytes.
// Omit damaged text instead of guessing its spelling or making PostgreSQL reject the release.
// eslint-disable-next-line no-control-regex
const DAMAGED_TEXT = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const usableText = (text: string, context: ConverterContextT): boolean => {
  if (!DAMAGED_TEXT.test(text)) return true;
  context.skip('malformed');
  return false;
};

const originsOf = (source: string, version: string | undefined): OriginT[] => {
  const catalog = findCatalogEntry('opengloss')!;
  const original = datasetOrigin({
    ...catalogTerms(catalog),
    name: catalog.name,
    title: catalog.title,
    version: version ?? null,
  });
  return source === 'wordnet-3.0'
    ? [
        original,
        {
          id: 'dataset:princeton-wordnet:3.0',
          name: 'Princeton WordNet',
          version: '3.0',
          url: 'https://wordnet.princeton.edu',
          licenses: [
            {
              spdx: 'WordNet',
              name: 'WordNet 3.0 license',
              url: 'https://wordnet.princeton.edu/license-and-commercial-use',
              text: WORDNET_3_0_NOTICE,
            },
          ],
          license_relation: 'all',
          attribution: 'WordNet 3.0 Copyright 2006 by Princeton University. All rights reserved.',
          notices: [],
          scope: 'word',
          method: 'dataset',
          recorded_at: null,
          inherited: true,
        },
      ]
    : [original];
};

const entryOf = (lexeme: LexemeT, sense: SenseT, context: ConverterContextT): ConvertedEntryT | null => {
  if (lexeme.language !== 'en') {
    context.skip('other_language');
    return null;
  }
  if (!PARTS.has(sense.pos)) {
    context.skip('unsupported_part_of_speech');
    return null;
  }
  if (lexeme.headword.length > HEADWORD_MAX_LENGTH) {
    context.skip('headword_too_long');
    return null;
  }
  if (!sense.gloss?.trim()) {
    context.skip('no_definition');
    return null;
  }
  if (!usableText(lexeme.headword, context) || !usableText(sense.gloss, context)) return null;
  const part = sense.pos as EnPartOfSpeechE;
  const entry = emptyEntry(lexeme.headword, part);
  entry.origins = originsOf(lexeme.source, context.version);
  entry.generated = true;
  // The upstream list also names deterministic rules and the WordNet migration; neither is a model.
  entry.generated_by_model = (lexeme.provenance_summary?.models ?? [])
    .filter((model) => model !== 'wordnet-3.0' && !model.startsWith('rule:') && usableText(model, context))
    .join(', ');
  entry.noun___is_proper = part === EnPartOfSpeechE.noun && lexeme.kind === 'proper_noun';
  entry.is_abbreviation = lexeme.kind === 'abbreviation';
  const base = lexeme.kind === 'phrasal_verb' ? phrasalBaseOf(entry.word, part) : null;
  entry.verb___is_phrasal = part === EnPartOfSpeechE.verb && lexeme.kind === 'phrasal_verb';
  entry.base_phrasal = base ?? '';
  const morphology = lexeme.morphology.find((item) => item.pos === sense.pos);
  if (morphology) {
    for (const [key, form_of_word, pos] of FORMS) {
      const word = morphology[key]?.trim();
      if (pos === part && word && word.length <= HEADWORD_MAX_LENGTH && usableText(word, context))
        entry.forms.push({ word, form_of_word });
    }
  }
  entry.noun___irregular_plural =
    part === EnPartOfSpeechE.noun &&
    entry.forms.some((form) => !isRegularForm(entry.word, form.word, form.form_of_word));
  entry.verb___is_irregular =
    part === EnPartOfSpeechE.verb &&
    entry.forms.some((form) => !isRegularForm(entry.word, form.word, form.form_of_word));
  const links = (type: string) => [
    ...new Set(
      sense.relations
        .filter(
          (relation) =>
            relation.type === type &&
            relation.target_term &&
            relation.target_term.length <= HEADWORD_MAX_LENGTH &&
            usableText(relation.target_term, context) &&
            relation.target_sense_id?.split(':').at(-2) === sense.pos,
        )
        .map((relation) => relation.target_term),
    ),
  ];
  entry.meanings = [
    {
      definition: sense.gloss.trim(),
      examples: [
        ...new Set(
          sense.examples
            .filter((example) => example.reading_level === 'neutral' && example.register === 'plain')
            .map((example) => example.text.trim())
            .filter((text) => text && usableText(text, context)),
        ),
      ],
      is_obsolete: false,
      area_variant: EnAreaVariantsE.common,
      language_register: '',
      categories: [],
      synonyms: links('synonym'),
      antonyms: links('antonym'),
      translations: [],
    },
  ];
  return entry;
};

export const opengloss: SourceAdapterT = {
  name: 'opengloss',
  description: 'OpenGloss senses + lexicon Parquet shards (CC BY 4.0; WordNet terms on marked words)',
  provenance: (options) => termsOfAdapter('opengloss', options),
  versionOf: openGlossVersion,
  async convert(input, options, context) {
    const files = await openGlossFiles(input, options);
    const total = (
      await Promise.all(
        [...files.senses, ...files.lexicon, ...files.lexicon].map(async (file) => (await stat(file)).size),
      )
    ).reduce((a, b) => a + b, 0);
    const read = new Map<string, number>();
    const progress = (file: string, bytes: number) => {
      read.set(file, bytes);
      context.progress?.(
        [...read.values()].reduce((a, b) => a + b, 0),
        total,
      );
    };
    // A form may precede or follow its lemma, including across shard boundaries.
    // Index compact morphology first, then join senses without buffering the release.
    const inflections = new OpenGlossInflections();
    for await (const lexeme of openGlossRows<LexemeT>(
      files.lexicon,
      COLUMNS.lexicon.filter((column) => column !== 'provenance_summary'),
      (file, bytes) => progress(`inflections:${file}`, bytes),
    )) {
      inflections.add(lexeme);
    }
    inflections.prepare();
    const flush = async () => {
      const folded = await inflections.flush(context.emit);
      context.log(`Folded ${folded} OpenGloss verb articles into their base entries`);
    };
    const senses = openGlossRows<SenseT>(files.senses, COLUMNS.senses, progress);
    let sense = await senses.next();
    let previous = '';
    let count = 0;
    try {
      // Both official tables are ordered by lexeme_id. Merge the streams, including shard boundaries.
      for await (const lexeme of openGlossRows<LexemeT>(files.lexicon, COLUMNS.lexicon, progress)) {
        if (
          !lexeme.lexeme_id ||
          !lexeme.headword ||
          lexeme.lexeme_id <= previous ||
          !['opengloss-v1.3', 'wordnet-3.0'].includes(lexeme.source) ||
          !Array.isArray(lexeme.sense_ids) ||
          typeof lexeme.retired !== 'boolean' ||
          !Array.isArray(lexeme.morphology)
        ) {
          throw new Error('Invalid OpenGloss lexicon, source, or shard order');
        }
        previous = lexeme.lexeme_id;
        const expected = new Set(lexeme.sense_ids);
        if (lexeme.retired && expected.size) throw new Error('Retired OpenGloss lexeme has live senses');
        while (!sense.done && sense.value.lexeme_id === lexeme.lexeme_id) {
          const row = sense.value;
          if (
            row.source !== lexeme.source ||
            row.headword !== lexeme.headword ||
            !expected.delete(row.sense_id) ||
            !Array.isArray(row.examples) ||
            !Array.isArray(row.relations)
          ) {
            throw new Error('OpenGloss senses and lexicon do not match');
          }
          const entry = entryOf(lexeme, row, context);
          if (entry && !inflections.take(entry)) await context.emit(entry);
          count += 1;
          if (context.limit !== undefined && count >= context.limit) {
            await flush();
            return;
          }
          sense = await senses.next();
        }
        if (expected.size || (!sense.done && sense.value.lexeme_id < lexeme.lexeme_id)) {
          throw new Error('Missing or out-of-order OpenGloss senses/lexicon shard');
        }
      }
      if (!sense.done) throw new Error('OpenGloss senses have no matching lexicon record');
      await flush();
      context.log(`Read ${count} OpenGloss senses`);
    } finally {
      await senses.return(undefined);
    }
  },
};
