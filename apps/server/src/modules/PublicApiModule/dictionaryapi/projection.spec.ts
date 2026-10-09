import { EnAreaVariantsE, EnPartOfSpeechE, PublicWordV1T, OriginT } from '../../../../types';
import { licensesOf } from '../../../../core/utils/provenance';
import { toDictionaryApiV1, toDictionaryApiV2 } from './projection';

// Original fixtures, not copied dictionary content. Unused native fields do not affect this projection.
const entry = (changes: Partial<PublicWordV1T> = {}): PublicWordV1T =>
  ({
    word: 'glimmer',
    part_of_speech: EnPartOfSpeechE.noun,
    meanings: [],
    pronunciations: [],
    source: 'our-dictionary',
    modified: false,
    ...changes,
  }) as PublicWordV1T;
const meaning = (definition: string, synonyms: string[], examples: string[] = []) =>
  ({
    definition,
    synonyms,
    antonyms: ['darkness', 'darkness'],
    examples,
  }) as PublicWordV1T['meanings'][number];
const origin: OriginT = {
  id: 'fixture',
  name: 'Our dictionary',
  version: null,
  licenses: [{ name: 'Custom', url: '', text: 'Keep this notice.' }],
  license_relation: 'all',
  attribution: 'Written by the fixture author',
  notices: ['An original fixture'],
  scope: 'word',
  method: 'manual',
  recorded_at: null,
  inherited: false,
};

describe('dictionaryapi projections', () => {
  it('flattens definitions, selects one example and aggregates sorted unique links without losing v1 definitions', () => {
    const values = [
      entry({
        part_of_speech: EnPartOfSpeechE.modal_verb,
        meanings: [
          meaning('First definition', ['shine', 'beam', 'shine'], ['', 'One example.', 'Another example.']),
          meaning('Second definition', ['beam']),
        ],
        etymologies: [
          { number: 2, text: 'Second origin' },
          { number: 1, text: 'First origin' },
        ],
      }),
    ];
    const [result] = toDictionaryApiV2(values);
    expect(result.origin).toBe('First origin\n\nSecond origin');
    expect(result.meanings).toEqual([
      {
        partOfSpeech: 'verb',
        synonyms: ['beam', 'shine'],
        antonyms: ['darkness'],
        definitions: [
          {
            definition: 'First definition',
            synonyms: ['beam', 'shine'],
            antonyms: ['darkness'],
            example: 'One example.',
          },
          { definition: 'Second definition', synonyms: ['beam'], antonyms: ['darkness'] },
        ],
      },
    ]);
    const [legacy] = toDictionaryApiV1(values);
    expect(legacy).not.toHaveProperty('meanings');
    expect(legacy.meaning).toEqual({ verb: result.meanings[0].definitions });
  });

  it('omits unavailable scalar fields, retains empty lists, and never fabricates Wiktionary terms', () => {
    const [result] = toDictionaryApiV2([entry()]);
    expect(result).not.toHaveProperty('phonetic');
    expect(result).not.toHaveProperty('origin');
    expect(result).not.toHaveProperty('license');
    expect(result.phonetics).toEqual([]);
    expect(result.meanings[0]).toEqual({ partOfSpeech: 'noun', definitions: [], synonyms: [], antonyms: [] });
    expect(JSON.stringify(result)).not.toContain('wiktionary');
  });

  it('preserves custom terms, mixed provenance, alternative license relations and contribution notices', () => {
    const contribution = {
      ...origin,
      id: 'edit',
      license_relation: 'any' as const,
      licenses: [{ name: 'Other', url: 'https://example.org/license' }],
    };
    const values = [
      entry({
        origins: [origin],
        contributions: [contribution],
        licenses: licensesOf([origin, contribution]),
        modified: true,
      }),
    ];
    const [result] = toDictionaryApiV2(values);
    expect(result.license).toEqual({
      name: 'Multiple licenses — see vocabBloom terms',
      url: '/api/v1/words/glimmer/datasets',
    });
    expect(result.vocabBloom).toEqual({
      dataset: 'default',
      source: 'our-dictionary',
      modified: true,
      origins: [origin],
      contributions: [contribution],
      licenses: values[0].licenses,
    });
    expect(result.sourceUrls).toContain('/api/v1/words/glimmer/datasets/default/history');
    const [custom] = toDictionaryApiV2([entry({ origins: [origin] })]);
    expect(custom.license).toEqual({ name: 'Custom', url: '/api/v1/words/glimmer/datasets' });
    expect(custom.vocabBloom.origins[0].licenses[0].text).toBe('Keep this notice.');
  });

  it('projects IPA, audio-only and every recording without calling EnPR IPA or borrowing text licenses', () => {
    const license = { name: 'Recording license', url: 'https://example.org/audio-license' };
    const [result] = toDictionaryApiV2([
      entry({
        origins: [origin],
        pronunciations: [
          { type: 'ipa', text: '/uk/', area_variant: EnAreaVariantsE.british, sort_order: 1 },
          {
            type: 'ipa',
            text: '/us/',
            area_variant: EnAreaVariantsE.american,
            sort_order: 2,
            audio: [
              { url: 'https://example.org/second.mp3', sort_order: 2, licenses: [] },
              {
                url: 'https://example.org/first.mp3',
                sort_order: 1,
                source_url: 'https://example.org/recording',
                attribution: 'Speaker',
                licenses: [license],
              },
            ],
          },
          { type: 'enpr', text: 'enpr', area_variant: EnAreaVariantsE.common, sort_order: 3 },
          {
            type: 'ipa',
            text: null,
            area_variant: EnAreaVariantsE.australian,
            sort_order: 4,
            audio: [{ url: 'https://example.org/au.mp3', licenses: [], sort_order: 0 }],
          },
        ],
      }),
    ]);
    expect(result.phonetic).toBe('/us/');
    expect(result.phonetics).toEqual([
      { text: '/uk/', audio: '' },
      {
        text: '/us/',
        audio: 'https://example.org/first.mp3',
        sourceUrl: 'https://example.org/recording',
        license,
        vocabBloom: { attribution: 'Speaker', licenses: [license] },
      },
      {
        text: '/us/',
        audio: 'https://example.org/second.mp3',
        vocabBloom: { attribution: null, licenses: [] },
      },
      { audio: 'https://example.org/au.mp3', vocabBloom: { attribution: null, licenses: [] } },
    ]);
  });

  it('keeps separate provenance and case for each native entry and maps every POS', () => {
    for (const pos of Object.values(EnPartOfSpeechE)) {
      expect(toDictionaryApiV2([entry({ part_of_speech: pos })])[0].meanings[0].partOfSpeech).toEqual(
        expect.any(String),
      );
    }
    const result = toDictionaryApiV2([entry({ word: 'Polish', origins: [origin] }), entry({ word: 'polish' })]);
    expect(result.map((value) => value.word)).toEqual(['Polish', 'polish']);
    expect(result[1]).not.toHaveProperty('license');
  });
});
