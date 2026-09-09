import { AvailableTranslationLanguagesE } from 'server/types';
import { AuthHeaderModeE, BulkRequestConfigT, PromptPresetT, ResponseMapperIdE, SourceKindE } from './types';

export const RECORDS_PAGE_SIZE = 50;
// page size used while collecting "everything matching the filter" for a run;
// equals LIST_MAX_LIMIT on the server
export const RUN_COLLECT_PAGE_SIZE = 200;
export const MIN_CONCURRENCY = 1;
export const MAX_CONCURRENCY = 1000;
export const MAX_RETRIES = 5;
// how many failures the panel renders; the full list is always downloadable
export const FAILURES_PREVIEW_LIMIT = 100;

export const RESULTS_FILE_NAME = 'vocab-bloom-hub-bulk-request-results.jsonl';
export const FAILURES_FILE_NAME = 'vocab-bloom-hub-bulk-request-failures.jsonl';

// The language names the prompts are written with (the prompts are English).
// One entry per member of the enum: a new translation language fails to
// type-check until it is named here, and then gets its presets automatically
export const PROMPT_LANGUAGE_NAMES: Record<AvailableTranslationLanguagesE, string> = {
  [AvailableTranslationLanguagesE.ru]: 'Russian',
  [AvailableTranslationLanguagesE.es]: 'Spanish',
  [AvailableTranslationLanguagesE.fr]: 'French',
};

const TRANSLATION_LANGUAGES = Object.values(AvailableTranslationLanguagesE);

// The answer of the short-translation presets mirrors an en_short_translations
// row (language, description, variants_of_words), so a jsonl line can be
// loaded as a new row of the word; the language in the answer overrides the
// source row's language in the line
const shortTranslationAnswer = (language: AvailableTranslationLanguagesE) =>
  `{"language": "${language}", "description": "...", "variants_of_words": ["...", "..."]}`;

const shortTranslationShape = (language: AvailableTranslationLanguagesE) => {
  const name = PROMPT_LANGUAGE_NAMES[language];
  return (
    `"description" is one or two sentences in ${name} explaining what the word means, covering its main senses; ` +
    `"variants_of_words" lists 3 to 10 ${name} equivalents in their base form, the most common first, ` +
    'or the closest paraphrases when there is no one-word equivalent.'
  );
};

// A short translation of a word written from scratch, the way the existing
// rows were produced: the words source, one request per word
const shortTranslationFromWord = (language: AvailableTranslationLanguagesE): PromptPresetT => ({
  id: `short_translation_${language}`,
  labelKey: 'preset_short_translation',
  language,
  template:
    `Give the short translation into ${PROMPT_LANGUAGE_NAMES[language]} of the English {{part_of_speech}} "{{word}}" ` +
    `in the form ${shortTranslationAnswer(language)}: ${shortTranslationShape(language)} ` +
    'If the word is a proper noun or an abbreviation, explain it in the description and give its ' +
    `${PROMPT_LANGUAGE_NAMES[language]} rendering as the only variant.`,
});

// The same short translation into another language, mirroring an existing
// row (filter the source by the language to copy from, e.g. ru → es)
const shortTranslationFromRow = (language: AvailableTranslationLanguagesE): PromptPresetT => ({
  id: `short_translation_${language}`,
  labelKey: 'preset_short_translation',
  language,
  template:
    `Give the short translation into ${PROMPT_LANGUAGE_NAMES[language]} of the English {{part_of_speech}} "{{word}}" ` +
    `in the form ${shortTranslationAnswer(language)}, mirroring its existing short translation into "{{language}}": ` +
    'description "{{description}}", variants "{{variants_of_words}}". Keep the same senses and the same shape: ' +
    `${shortTranslationShape(language)} ` +
    'Translate the meaning of the English word, not the wording of the existing translation.',
});

// The answer of the meaning-translation presets mirrors an
// en_meanings_translations row (language, title, definition,
// variants_of_words); the line keeps meaning_id, so it can be loaded as a new
// translation of the meaning
const meaningTranslationAnswer = (language: AvailableTranslationLanguagesE) =>
  `{"language": "${language}", "title": "...", "definition": "...", "variants_of_words": ["...", "..."]}`;

const meaningTranslationShape = (language: AvailableTranslationLanguagesE) => {
  const name = PROMPT_LANGUAGE_NAMES[language];
  return (
    `"title" is the title of the meaning in ${name}, a few words; "definition" is its definition in ${name}, ` +
    `one or two sentences; "variants_of_words" lists 3 to 8 ${name} equivalents of the word in this meaning only, ` +
    'in their base form, the most common first, or the closest paraphrases when there is no one-word equivalent.'
  );
};

// A translation of a meaning written from scratch: the meanings source, one
// request per meaning
const meaningTranslationFromMeaning = (language: AvailableTranslationLanguagesE): PromptPresetT => ({
  id: `meaning_translation_${language}`,
  labelKey: 'preset_meaning_translation',
  language,
  template:
    `Give the translation into ${PROMPT_LANGUAGE_NAMES[language]} of the English {{part_of_speech}} "{{word}}" ` +
    'in the meaning "{{title}}" ({{definition}}) ' +
    `in the form ${meaningTranslationAnswer(language)}: ${meaningTranslationShape(language)} ` +
    'Translate this meaning only, not the other meanings of the word.',
});

// The same translation into another language, mirroring an existing row
// (filter the source by the language to copy from, e.g. ru → es)
const meaningTranslationFromRow = (language: AvailableTranslationLanguagesE): PromptPresetT => ({
  id: `meaning_translation_${language}`,
  labelKey: 'preset_meaning_translation',
  language,
  template:
    `Give the translation into ${PROMPT_LANGUAGE_NAMES[language]} of the English {{part_of_speech}} "{{word}}" ` +
    'in the meaning "{{meaning_title}}" ({{meaning_definition}}) ' +
    `in the form ${meaningTranslationAnswer(language)}, mirroring its existing translation into "{{language}}": ` +
    'title "{{title}}", definition "{{definition}}", variants "{{variants_of_words}}". ' +
    `Keep the same shape: ${meaningTranslationShape(language)} ` +
    'Translate the English meaning, not the wording of the existing translation.',
});

// The prompt presets of every source table; the first one is the default the
// table starts with, switching the table keeps the task when the new table has
// a preset with the same id
export const PROMPT_PRESETS: Record<SourceKindE, readonly PromptPresetT[]> = {
  [SourceKindE.words]: [
    {
      id: 'synonyms',
      labelKey: 'preset_synonyms',
      template:
        'Give synonyms for the English {{part_of_speech}} "{{word}}" in the form {"synonyms": ["...", "..."]}. ' +
        'If the word is a proper noun or an abbreviation, answer {"synonyms": []}.',
    },
    ...TRANSLATION_LANGUAGES.map(shortTranslationFromWord),
  ],
  [SourceKindE.meanings]: [
    {
      id: 'synonyms_antonyms',
      labelKey: 'preset_synonyms_antonyms',
      template:
        'Give synonyms and antonyms for the English {{part_of_speech}} "{{word}}" only in the meaning "{{title}}" ({{definition}}): ' +
        'single words of the same part of speech in their base form — synonyms that can replace it in this meaning, ' +
        'antonyms that mean the opposite in this meaning — excluding "{{word}}" itself and its inflected forms, ' +
        'in the form {"synonyms": ["...", "..."], "antonyms": ["...", "..."]}. ' +
        'Use an empty list for a side this meaning does not have, e.g. {"synonyms": [], "antonyms": []}.',
    },
    ...TRANSLATION_LANGUAGES.map(meaningTranslationFromMeaning),
  ],
  [SourceKindE.translations]: [
    {
      id: 'check',
      labelKey: 'preset_check',
      template:
        'Check the translation into "{{language}}" of the English {{part_of_speech}} "{{word}}" in the meaning ' +
        '"{{meaning_title}}" ({{meaning_definition}}): title "{{title}}", definition "{{definition}}". ' +
        'Answer in the form {"is_correct": true, "title": "...", "definition": "...", "comment": "..."}, ' +
        'repeating the current title and definition when they are correct and giving better ones otherwise.',
    },
    ...TRANSLATION_LANGUAGES.map(meaningTranslationFromRow),
  ],
  [SourceKindE.short_translations]: [
    {
      id: 'check',
      labelKey: 'preset_check',
      template:
        'Check the short translation into "{{language}}" of the English {{part_of_speech}} "{{word}}": ' +
        '"{{description}}". Answer in the form {"is_correct": true, "description": "...", "comment": "..."}, ' +
        'repeating the current description when it is correct and giving a better one otherwise.',
    },
    ...TRANSLATION_LANGUAGES.map(shortTranslationFromRow),
  ],
};

// The default prompt of every source table: its first preset
export const DEFAULT_PROMPT_TEMPLATES: Record<SourceKindE, string> = Object.fromEntries(
  Object.entries(PROMPT_PRESETS).map(([kind, presets]) => [kind, presets[0].template]),
) as Record<SourceKindE, string>;

/** The preset of the table whose template the prompt still is; undefined once edited */
export const findPromptPreset = (kind: SourceKindE, template: string): PromptPresetT | undefined =>
  PROMPT_PRESETS[kind].find((preset) => preset.template === template);

/**
 * The prompt to show after switching the table: an edited prompt is kept, an
 * untouched preset becomes the same task of the new table when it has one,
 * otherwise the new table's default
 */
export const promptAfterSourceSwitch = (from: SourceKindE, to: SourceKindE, template: string): string => {
  const current = findPromptPreset(from, template);
  if (!current) return template;
  return (PROMPT_PRESETS[to].find((preset) => preset.id === current.id) ?? PROMPT_PRESETS[to][0]).template;
};

// Chat-completions body: a fixed system message sets the JSON-only contract,
// the rendered prompt for one row goes in as the user message; placeholders
// are injected JSON-escaped. DeepSeek thinks by default (effort "high"):
// `thinking` switches it off, the answer is a small JSON object and the
// reasoning would only cost time and tokens; `think` is the same switch of
// Ollama, ignored by the other APIs
export const DEFAULT_BODY_TEMPLATE = `{
  "model": "deepseek-v4-flash",
  "messages": [
    {
      "role": "system",
      "content": "You are a language API service. You always answer with a single JSON object and nothing else: no prose, no markdown, no code fences. If you believe there is no correct answer, answer with a JSON object of the form {\\"error\\": \\"<short reason>\\"} instead of guessing."
    },
    { "role": "user", "content": "{{prompt}}" }
  ],
  "stream": false,
  "thinking": { "type": "disabled" },
  "think": false
}`;

export const DEFAULT_SOURCE_KIND = SourceKindE.words;

export const DEFAULT_CONFIG: BulkRequestConfigT = {
  url: 'https://api.deepseek.com/chat/completions',
  apiKey: '',
  authHeaderMode: AuthHeaderModeE.bearer,
  customAuthHeaderName: '',
  extraHeaders: '',
  promptTemplate: DEFAULT_PROMPT_TEMPLATES[DEFAULT_SOURCE_KIND],
  bodyTemplate: DEFAULT_BODY_TEMPLATE,
  mapper: ResponseMapperIdE.json_in_text,
  responsePath: 'choices[0].message.content',
  concurrency: 2,
  maxRetries: 3,
};
