import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { validOrigins } from '../../core/utils/provenance';
import { convert } from '../convert';
import { opengloss } from '../sources/opengloss';
import { validateOpenGlossFiles } from '../sources/opengloss/files';
import { ConvertedEntryT } from '../types';
import {
  openGlossFixtureRows,
  openGlossInflectionFixtureRows,
  writeOpenGlossFixture,
} from './opengloss-fixture';

describe('OpenGloss Parquet conversion', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'opengloss-test-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });
  const entries = async (options: Record<string, string> = {}, input = dir) => {
    const result: ConvertedEntryT[] = [];
    await opengloss.convert(input, options, {
      emit: async (entry) => {
        result.push(entry);
      },
      skip: () => undefined,
      log: () => undefined,
      version: 'test-release',
    });
    return result;
  };

  it('joins nested Zstd Parquet tables across shards; preserves source terms, generated flags and morphology', async () => {
    const files = await writeOpenGlossFixture(dir);
    await validateOpenGlossFiles(files.file, files);
    const outDir = path.join(dir, 'converted');
    const summary = await convert({
      source: opengloss,
      input: files.file,
      sourceOptions: files,
      outDir,
      version: 'test-release',
    });
    expect(summary).toMatchObject({ entries: 3, meanings: 4, late_duplicates: 0, skipped: {} });
    const words = (await readFile(path.join(outDir, 'vocab-bloom-hub-en-words.jsonl'), 'utf8'))
      .trim()
      .split('\n')
      .map((row) => JSON.parse(row));
    const original = words.find((word) => word.word === 'glimmer' && word.part_of_speech === 'noun');
    expect(original).toMatchObject({
      generated: true,
      generated_by_model: 'fixture-model',
      origins: [{ name: 'OpenGloss', version: 'test-release', licenses: [{ spdx: 'CC-BY-4.0' }] }],
    });
    const derived = words.find((word) => word.word === 'Northstar');
    expect(original.origins[0].licenses[0]).not.toHaveProperty('text');
    expect(derived).toMatchObject({ noun___is_proper: true, generated_by_model: 'fixture-model' });
    expect(
      derived.origins.map((origin: { name: string; version: string }) => [origin.name, origin.version]),
    ).toEqual([
      ['OpenGloss', 'test-release'],
      ['Princeton WordNet', '3.0'],
    ]);
    expect(derived.origins[1].licenses[0].text).toContain('Copyright 2006');
    expect(words.filter((word) => word.origins).every((word) => validOrigins(word.origins))).toBe(true);
    expect(words.some((word) => word.word === 'hush')).toBe(false);
    expect(words.find((word) => word.part_of_speech === 'verb').forms).toEqual(
      expect.arrayContaining([expect.objectContaining({ word: 'glimmered', form_of_word: 'past_simple' })]),
    );
    const license = await readFile(path.join(outDir, 'LICENSE'), 'utf8');
    expect(license).toContain('THIS SOFTWARE AND DATABASE IS PROVIDED "AS IS"');
    expect(license).toContain('Michael J. Bommarito II');
    const [first] = await entries();
    expect(first.meanings[0]).toMatchObject({
      examples: ['The test robot found a glimmer.'],
      synonyms: ['Northstar'],
      antonyms: [],
      translations: [],
    });
  });

  it('omits damaged definitions, examples and forms without corrupting the remaining senses', async () => {
    const rows = openGlossFixtureRows();
    rows.senses[0].gloss = 'Broken \u0000e9 text.';
    rows.senses[1].examples = [{ text: 'Broken \u0016 example.', reading_level: 'neutral', register: 'plain' }];
    rows.lexicon[0].morphology[0].plural = 'gli\u0000mmers';
    await writeOpenGlossFixture(dir, rows);
    const words = await entries();
    expect(words).toHaveLength(3);
    expect(words[0].meanings[0].definition).toBe('A second invented test signal.');
    expect(words[0].meanings[0].examples).toEqual([]);
    expect(words[0].forms).toEqual([]);
    expect(JSON.stringify(words)).not.toContain('\\u0000');
    expect(words[0].origins?.[0].licenses[0].spdx).toBe('CC-BY-4.0');
  });

  it('preserves inflections with the same spelling as the headword', async () => {
    const rows = openGlossFixtureRows();
    rows.lexicon[0].morphology[0].plural = 'glimmer';
    rows.lexicon[0].morphology[1].past_tense = 'glimmer';
    rows.lexicon[0].morphology[1].past_participle = 'glimmer';
    await writeOpenGlossFixture(dir, rows);
    const words = await entries();
    expect(words.find((word) => word.part_of_speech === 'noun')).toMatchObject({
      noun___irregular_plural: true,
      forms: [{ word: 'glimmer', form_of_word: 'plural_form' }],
    });
    expect(words.find((word) => word.part_of_speech === 'verb')).toMatchObject({
      verb___is_irregular: true,
      forms: expect.arrayContaining([
        { word: 'glimmer', form_of_word: 'past_simple' },
        { word: 'glimmer', form_of_word: 'past_participle' },
      ]),
    });
  });

  it('stores inflected verbs under their lemma across shards, retaining meanings and other parts of speech', async () => {
    const rows = openGlossInflectionFixtureRows();
    await writeOpenGlossFixture(dir, rows);
    const words = await entries();
    const verbs = words.filter((word) => word.part_of_speech === 'verb');
    expect(verbs).toHaveLength(1);
    expect(verbs[0]).toMatchObject({
      word: 'run',
      verb___is_irregular: true,
      forms: [
        { word: 'ran', form_of_word: 'past_simple' },
        { word: 'run', form_of_word: 'past_participle' },
        { word: 'running', form_of_word: 'present_participle' },
        { word: 'runs', form_of_word: 'third_person_singular' },
      ],
    });
    expect(verbs[0].meanings.map((meaning) => meaning.definition)).toEqual([
      'An invented verb definition filed under run.',
      'An invented verb definition filed under ran.',
      'An invented verb definition filed under running.',
      'An invented verb definition filed under runs.',
    ]);
    expect(verbs[0].meanings.flatMap((meaning) => meaning.examples)).toContain('A test example for ran.');
    expect(verbs[0].origins).toHaveLength(1);
    expect(
      words.filter((word) => word.part_of_speech !== 'verb').map((word) => [word.word, word.part_of_speech]),
    ).toEqual([
      ['run', 'noun'],
      ['running', 'adjective'],
      ['running', 'noun'],
      ['runs', 'noun'],
    ]);
    const outDir = path.join(dir, 'folded');
    const summary = await convert({ source: opengloss, input: dir, outDir, version: 'test-release' });
    expect(summary).toMatchObject({ entries: 5, meanings: 8, late_duplicates: 0 });
  });

  it('keeps verb articles when the source cannot identify a usable base', async () => {
    const rows = openGlossInflectionFixtureRows();
    // The base has no usable verb definition: do not lose the other entries.
    rows.senses.find((sense) => sense.sense_id === 'run:verb:0')!.gloss = '';
    await writeOpenGlossFixture(dir, rows);
    expect((await entries()).filter((word) => word.part_of_speech === 'verb').map((word) => word.word)).toEqual(
      ['ran', 'running', 'runs'],
    );
  });

  it('keeps ambiguous irregular homographs even when the source repeats the wrong paradigm', async () => {
    const rows = openGlossFixtureRows();
    rows.lexicon = [];
    rows.senses = [];
    const template = openGlossInflectionFixtureRows();
    for (const word of ['saw', 'see']) {
      const base = template.lexicon.find((entry) => entry.headword === 'run')!;
      rows.lexicon.push({
        ...base,
        lexeme_id: word,
        headword: word,
        sense_ids: [`${word}:noun:0`, `${word}:verb:0`],
        morphology: [
          {
            pos: 'verb',
            past_tense: 'saw',
            past_participle: 'seen',
            present_participle: 'seeing',
            third_person_singular: 'sees',
          },
        ],
      });
      for (const pos of ['noun', 'verb'])
        rows.senses.push({
          ...template.senses[0],
          lexeme_id: word,
          headword: word,
          sense_id: `${word}:${pos}:0`,
          pos,
        });
    }
    await writeOpenGlossFixture(dir, rows);
    expect((await entries()).map((entry) => [entry.word, entry.part_of_speech])).toEqual([
      ['saw', 'noun'],
      ['saw', 'verb'],
      ['see', 'noun'],
      ['see', 'verb'],
    ]);
  });

  it('keeps a distinct verb paradigm and does not turn a regular base irregular when merging', async () => {
    const rows = openGlossInflectionFixtureRows();
    // The spelling alone is insufficient: this entry declares another paradigm.
    rows.lexicon[0].morphology[0].past_tense = 'ranned';
    await writeOpenGlossFixture(dir, rows);
    expect(
      (await entries()).filter((entry) => entry.part_of_speech === 'verb').map((entry) => entry.word),
    ).toEqual(['ran', 'run']);

    const regular = openGlossFixtureRows();
    const base = regular.lexicon[0];
    regular.lexicon.splice(1, 0, {
      ...base,
      lexeme_id: 'glimmered',
      headword: 'glimmered',
      sense_ids: ['glimmered:verb:0'],
      morphology: [base.morphology[1]],
    });
    regular.senses.splice(3, 0, {
      ...regular.senses[2],
      lexeme_id: 'glimmered',
      headword: 'glimmered',
      sense_id: 'glimmered:verb:0',
      gloss: 'Another invented action.',
    });
    await writeOpenGlossFixture(dir, regular);
    const verbs = (await entries()).filter((entry) => entry.part_of_speech === 'verb');
    expect(verbs).toHaveLength(1);
    expect(verbs[0]).toMatchObject({ word: 'glimmer', verb___is_irregular: false });
    expect(verbs[0].meanings).toHaveLength(2);
  });

  it('keeps degrees of adverbs as well as adjectives', async () => {
    const rows = openGlossFixtureRows();
    rows.senses[2].pos = 'adverb';
    rows.senses[2].sense_id = 'glimmer:adverb:0';
    rows.lexicon[0].sense_ids[2] = 'glimmer:adverb:0';
    Object.assign(rows.lexicon[0].morphology[1], {
      pos: 'adverb',
      comparative: 'more glimmer',
      superlative: 'most glimmer',
    });
    await writeOpenGlossFixture(dir, rows);
    const adverb = (await entries()).find((entry) => entry.part_of_speech === 'adverb');
    expect(adverb?.forms).toEqual([
      { word: 'more glimmer', form_of_word: 'comparative_form' },
      { word: 'most glimmer', form_of_word: 'superlative_form' },
    ]);
  });

  it('does not infer release 2.4 from filenames or override options', async () => {
    await writeOpenGlossFixture(dir);
    expect(await opengloss.versionOf(dir, { version: '2.4' })).toBeNull();
  });

  it.each(['source', 'sense_ids', 'headword'] as const)(
    'refuses mismatched %s instead of assigning incomplete licenses',
    async (field) => {
      const rows = openGlossFixtureRows();
      if (field === 'sense_ids') rows.lexicon[0].sense_ids.push('missing:noun:0');
      else rows.lexicon[0][field] = 'unexpected';
      await writeOpenGlossFixture(dir, rows);
      await expect(entries()).rejects.toThrow(/OpenGloss/);
    },
  );

  it('does not publish a completed manifest when a later shard has missing senses', async () => {
    const rows = openGlossFixtureRows();
    rows.lexicon[2].sense_ids.push('northstar:noun:missing');
    await writeOpenGlossFixture(dir, rows);
    const outDir = path.join(dir, 'incomplete');
    await expect(convert({ source: opengloss, input: dir, outDir })).rejects.toThrow(/OpenGloss/);
    await expect(readFile(path.join(outDir, 'manifest.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('refuses absent, corrupted and incorrectly ordered shards', async () => {
    const files = await writeOpenGlossFixture(dir);
    await expect(
      entries({ ...files, senses_1: files.senses_2, senses_2: files.senses_1 }, files.file),
    ).rejects.toThrow(/OpenGloss/);
    await writeFile(files.lexicon, 'not a parquet file');
    await expect(validateOpenGlossFiles(files.file, files)).rejects.toThrow();
    await expect(validateOpenGlossFiles(files.file, {})).rejects.toThrow('Missing OpenGloss file');
  });
});
