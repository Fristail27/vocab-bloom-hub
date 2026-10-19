import { issueInterpretation } from '../statistics';

describe('data quality categories respect source capabilities', () => {
  it.each(['wordnet', 'wordnet_princeton'])('explains missing translations and levels in %s', (name) => {
    for (const key of [
      'words_without_short_translations',
      'meanings_without_translations',
      'words_without_level',
    ] as const) {
      expect(issueInterpretation(key, { name, own: false })).toBe('source_omission');
    }
  });
  it('does not infer obligations for own datasets, even with a catalog name', () => {
    expect(issueInterpretation('words_without_level', { name: 'default', own: true })).toBe('informational');
    expect(issueInterpretation('words_without_meanings', { name: 'mine', own: true })).toBe('informational');
  });
  it('does not require synonyms, antonyms or a redundant word description', () => {
    for (const key of [
      'meanings_without_synonyms',
      'meanings_without_antonyms',
      'words_without_description',
    ] as const) {
      expect(issueInterpretation(key, { name: 'default', own: false })).toBe('informational');
    }
    expect(issueInterpretation('words_without_meanings', { name: 'default', own: false })).toBe('missing');
    expect(issueInterpretation('empty_short_translations', { name: 'mine', own: true })).toBe('empty');
  });
});
