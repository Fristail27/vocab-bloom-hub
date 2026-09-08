import { AvailableTranslationLanguagesE } from 'server/types';
import { SourceKindE } from '../types';
import {
  DEFAULT_PROMPT_TEMPLATES,
  findPromptPreset,
  PROMPT_LANGUAGE_NAMES,
  PROMPT_PRESETS,
  promptAfterSourceSwitch,
} from '../constants';
import { SOURCE_PLACEHOLDERS } from '../sources';
import { listPlaceholders } from '../utils/renderTemplate';

describe('prompt presets', () => {
  it('reference only the placeholders of their source table', () => {
    for (const kind of Object.values(SourceKindE)) {
      for (const preset of PROMPT_PRESETS[kind]) {
        const unknown = listPlaceholders(preset.template).filter(
          (name) => !SOURCE_PLACEHOLDERS[kind].includes(name),
        );
        expect({ kind, preset: preset.id, unknown }).toEqual({ kind, preset: preset.id, unknown: [] });
      }
    }
  });

  it('start every table with its first preset and have unique ids per table', () => {
    for (const kind of Object.values(SourceKindE)) {
      expect(DEFAULT_PROMPT_TEMPLATES[kind]).toBe(PROMPT_PRESETS[kind][0].template);
      const ids = PROMPT_PRESETS[kind].map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('offer a short translation into every translation language from a word and from an existing row', () => {
    for (const language of Object.values(AvailableTranslationLanguagesE)) {
      const id = `short_translation_${language}`;
      const fromWord = PROMPT_PRESETS[SourceKindE.words].find((p) => p.id === id);
      const fromRow = PROMPT_PRESETS[SourceKindE.short_translations].find((p) => p.id === id);
      for (const preset of [fromWord, fromRow]) {
        expect(preset?.language).toBe(language);
        // the target language is named in words and its code sits in the answer shape
        expect(preset?.template).toContain(`into ${PROMPT_LANGUAGE_NAMES[language]} `);
        expect(preset?.template).toContain(
          `{"language": "${language}", "description": "...", "variants_of_words"`,
        );
      }
      // the row preset mirrors the existing translation, the word preset writes from scratch
      expect(fromRow?.template).toContain('"{{description}}"');
      expect(fromWord?.template).not.toContain('{{description}}');
    }
  });

  it('offer a meaning translation into every translation language from a meaning and from an existing row', () => {
    for (const language of Object.values(AvailableTranslationLanguagesE)) {
      const id = `meaning_translation_${language}`;
      const fromMeaning = PROMPT_PRESETS[SourceKindE.meanings].find((p) => p.id === id);
      const fromRow = PROMPT_PRESETS[SourceKindE.translations].find((p) => p.id === id);
      for (const preset of [fromMeaning, fromRow]) {
        expect(preset?.language).toBe(language);
        expect(preset?.template).toContain(`into ${PROMPT_LANGUAGE_NAMES[language]} `);
        expect(preset?.template).toContain(
          `{"language": "${language}", "title": "...", "definition": "...", "variants_of_words"`,
        );
      }
      // the meaning preset quotes the meaning's own columns, the row preset the parent meaning and the row
      expect(fromMeaning?.template).toContain('in the meaning "{{title}}" ({{definition}})');
      expect(fromRow?.template).toContain('in the meaning "{{meaning_title}}" ({{meaning_definition}})');
      expect(fromRow?.template).toContain('title "{{title}}", definition "{{definition}}"');
    }
  });

  it('are found by template and kept across a table switch when the task exists there', () => {
    const es = `short_translation_${AvailableTranslationLanguagesE.es}`;
    const wordsEs = PROMPT_PRESETS[SourceKindE.words].find((p) => p.id === es)!.template;
    const rowsEs = PROMPT_PRESETS[SourceKindE.short_translations].find((p) => p.id === es)!.template;

    expect(findPromptPreset(SourceKindE.words, wordsEs)?.id).toBe(es);
    expect(findPromptPreset(SourceKindE.words, `${wordsEs} edited`)).toBeUndefined();

    // the same task on the new table
    expect(promptAfterSourceSwitch(SourceKindE.words, SourceKindE.short_translations, wordsEs)).toBe(rowsEs);
    // no such task there: the new table's default
    expect(promptAfterSourceSwitch(SourceKindE.words, SourceKindE.meanings, wordsEs)).toBe(
      DEFAULT_PROMPT_TEMPLATES[SourceKindE.meanings],
    );
    // the untouched default follows the table
    expect(
      promptAfterSourceSwitch(
        SourceKindE.words,
        SourceKindE.meanings,
        DEFAULT_PROMPT_TEMPLATES[SourceKindE.words],
      ),
    ).toBe(DEFAULT_PROMPT_TEMPLATES[SourceKindE.meanings]);
    // an edited prompt stays
    expect(promptAfterSourceSwitch(SourceKindE.words, SourceKindE.meanings, 'my own prompt')).toBe(
      'my own prompt',
    );
  });
});
