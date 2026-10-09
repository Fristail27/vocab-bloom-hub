import type { OriginT, PublicWordV1T, PublicDatasetTermsV1T } from '../../../../types';
import { renderDataset, renderDefinition } from '../render';

const origin: OriginT = {
  id: 'original',
  name: 'Fixture source',
  version: 'edition 2',
  attribution: 'Named author',
  url: 'https://example.org/source',
  record_url: 'https://example.org/word',
  licenses: [
    { name: 'Custom text terms', url: '', text: 'Keep all these terms.\n.Second line.' },
    { name: 'Alternative license', url: 'https://example.org/license' },
  ],
  license_relation: 'any',
  notices: ['Original notice'],
  scope: 'word',
  method: 'manual',
  recorded_at: null,
  inherited: false,
};
describe('DICT text and exact attribution', () => {
  it('renders text origins, contributions and independent recording terms without collapsing them', () => {
    const word = {
      word: 'fixture',
      part_of_speech: 'verb',
      source: 'custom',
      modified: true,
      description: 'Description',
      origins: [origin],
      contributions: [{ ...origin, id: 'edit', name: 'Editor', license_relation: 'all' }],
      forms: [{ word: 'fixtures', form_of_word: 'third_person_singular' }],
      alternatives: ['fyxture'],
      etymologies: [{ number: 2, text: 'Linguistic history' }],
      pronunciations: [
        {
          type: 'ipa',
          text: '/example/',
          area_variant: 'common',
          sort_order: 0,
          audio: [
            {
              url: 'https://example.org/sound',
              attribution: 'Speaker',
              licenses: [{ name: 'Recording terms', url: 'https://example.org/audio-license' }],
              sort_order: 0,
            },
          ],
        },
      ],
      meanings: [
        {
          definition: 'Definition',
          etymology_number: 2,
          examples: ['Example'],
          synonyms: ['synonym'],
          antonyms: ['antonym'],
          quotes: [{ text: 'Quote', reference: 'A book', source_url: 'https://example.org/book' }],
          translations: [{ language: 'ru', variants_of_words: ['слово'] }],
        },
      ],
    } as unknown as PublicWordV1T;
    const text = renderDefinition(word, 'fixtures', 'own');
    for (const value of [
      'Requested spelling: fixtures',
      'Modified on this instance: yes',
      'edition 2',
      'license relation: any',
      'license relation: all',
      'Keep all these terms.\n.Second line.',
      'Original notice',
      'Recording terms',
      'Speaker',
      'Contribution: Editor',
      'Etymology: 2',
      'слово',
      'A book',
    ])
      expect(text).toContain(value);
    expect(text).not.toContain('Wiktionary');
    expect(renderDefinition({ ...word, origins: [], contributions: [] }, 'fixture', 'own')).toContain(
      'License information unavailable',
    );
  });
  it('renders dataset information and full custom terms separately from word origins', () => {
    const terms = {
      dataset: 'own',
      title: 'Title',
      source: 'own',
      dataset_version: '1',
      attribution: 'Dataset owner',
      attribution_url: 'https://example.org/author',
      license: 'Custom terms',
      license_url: 'https://example.org/terms',
      license_text: 'Full terms',
      notice: 'Notice',
      description: 'Description',
      origins: [origin],
    } as PublicDatasetTermsV1T;
    const text = renderDataset(terms, 'en');
    for (const value of [
      'Language: en',
      'Full terms',
      'Dataset owner',
      'Dataset origin: Fixture source',
      'Description',
    ])
      expect(text).toContain(value);
  });
});
