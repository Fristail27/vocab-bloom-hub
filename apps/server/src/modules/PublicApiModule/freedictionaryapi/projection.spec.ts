import {
  AvailableTranslationLanguagesE,
  CategoryE,
  EnAreaVariantsE,
  EnPartOfSpeechE,
  EnVerbTransitivityE,
  EnWordFormsE,
  LanguageRegisterE,
  PublicWordV1T,
} from '../../../../types';
import { FORM_TAGS, toFreeDictionaryEntries } from './projection';

const entry = (overrides: Partial<PublicWordV1T> = {}): PublicWordV1T =>
  ({
    word: 'fixture',
    part_of_speech: EnPartOfSpeechE.noun,
    forms: [],
    meanings: [],
    categories: [],
    source: 'own',
    modified: false,
    ...overrides,
  }) as PublicWordV1T;
const sense = (overrides: Partial<PublicWordV1T['meanings'][number]> = {}): PublicWordV1T['meanings'][number] =>
  ({
    definition: 'Original fixture.',
    examples: [],
    translations: [],
    synonyms: [],
    antonyms: [],
    categories: [],
    area_variant: EnAreaVariantsE.common,
    ...overrides,
  }) as PublicWordV1T['meanings'][number];

describe('freedictionaryapi projection', () => {
  it('maps both pronunciation notations, omits audio-only rows and inherits form pronunciations', () => {
    const original = entry({
      pronunciations: [
        { type: 'enpr', text: 'enpr fixture', area_variant: EnAreaVariantsE.british, sort_order: 1 },
        { type: 'ipa', text: '/ipa/', area_variant: EnAreaVariantsE.american, sort_order: 0 },
        {
          type: 'ipa',
          text: null,
          area_variant: EnAreaVariantsE.common,
          sort_order: 2,
          audio: [{ url: 'https://example.org/sound', licenses: [], sort_order: 0 }],
        },
      ],
    });
    const result = toFreeDictionaryEntries([original], 'fixture', 'test', false)[0];
    expect(result.pronunciations).toEqual([
      { type: 'ipa', text: '/ipa/', tags: ['American'] },
      { type: 'enpr', text: 'enpr fixture', tags: ['British'] },
    ]);
    expect(result.vocabBloom).toMatchObject({
      dataset: 'test',
      word: 'fixture',
      source: 'own',
      modified: false,
    });
    expect(result).not.toHaveProperty('audio');
  });

  it('maps known tags, aggregates sense links, preserves quotes and keeps senses flat', () => {
    const original = entry({
      part_of_speech: EnPartOfSpeechE.modal_verb,
      categories: [CategoryE.IT],
      verb___transitivity: EnVerbTransitivityE.both,
      meanings: [
        sense({
          language_register: LanguageRegisterE.formal,
          is_obsolete: true,
          synonyms: ['z', 'a', 'z'],
          antonyms: ['b'],
          quotes: [{ text: 'Quote', reference: null, source_url: 'https://example.org/quote' }],
        }),
        sense({ synonyms: ['a', 'c'], antonyms: ['b'] }),
      ],
    });
    const before = JSON.stringify(original);
    const result = toFreeDictionaryEntries([original], 'fixture', 'test', false)[0];
    expect(result.partOfSpeech).toBe('verb');
    expect(result.synonyms).toEqual(['a', 'c', 'z']);
    expect(result.antonyms).toEqual(['b']);
    expect(result.senses[0].tags).toEqual(['computing', 'formal', 'intransitive', 'obsolete', 'transitive']);
    expect(result.senses[0].quotes).toEqual([{ text: 'Quote', reference: 'https://example.org/quote' }]);
    expect(result.senses.every((sense) => sense.subsenses.length === 0)).toBe(true);
    expect(JSON.stringify(original)).toBe(before);
  });

  it('has explicit mappings for every current form enum and keeps alternatives distinct', () => {
    expect(Object.keys(FORM_TAGS).sort()).toEqual(Object.values(EnWordFormsE).sort());
    const original = entry({
      alternatives: ['alternate'],
      forms: [
        {
          id: 2,
          word: 'fixtures',
          form_of_word: EnWordFormsE.plural_form,
          area_variant: EnAreaVariantsE.common,
          transcription: null,
        },
      ],
    });
    expect(toFreeDictionaryEntries([original], 'alternate', 'test', false)[0].forms).toEqual([
      { word: 'fixture', tags: ['canonical'] },
      { word: 'fixtures', tags: ['plural'] },
      { word: 'alternate', tags: ['alternative'] },
    ]);
  });

  it('uses lexical variants rather than translated prose and omits unrepresented languages', () => {
    const original = entry({
      meanings: [
        sense({
          translations: [
            {
              id: 1,
              language: AvailableTranslationLanguagesE.fr,
              title: 'This is a prose description',
              definition: 'Another description',
              variants_of_words: ['mot', 'mot'],
            },
            {
              id: 2,
              language: 'unsupported' as AvailableTranslationLanguagesE,
              title: 'Ignored',
              definition: 'Ignored',
              variants_of_words: ['ignored'],
            },
          ],
        }),
        sense(),
      ],
    });
    expect(
      toFreeDictionaryEntries([original], 'fixture', 'test', true)[0].senses.map((sense) => sense.translations),
    ).toEqual([[{ language: { code: 'fr', name: 'French' }, word: 'mot' }], []]);
    expect(toFreeDictionaryEntries([original], 'fixture', 'test', false)[0].senses[0]).not.toHaveProperty(
      'translations',
    );
  });
});
