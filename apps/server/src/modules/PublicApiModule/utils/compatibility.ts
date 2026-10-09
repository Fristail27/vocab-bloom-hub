import type { OriginLicenseT } from '../../../../types';
import { EnPartOfSpeechE } from '../../../../types';
import type { DictionaryApiLicenseT } from '../../../../types/public/dictionaryapi';

export const COMPATIBILITY_POS: Record<EnPartOfSpeechE, string> = {
  noun: 'noun',
  verb: 'verb',
  modal_verb: 'verb',
  adjective: 'adjective',
  adverb: 'adverb',
  pronoun: 'pronoun',
  numeral: 'numeral',
  numeral_fractional: 'numeral',
  determiner: 'determiner',
  interjection: 'interjection',
  article: 'article',
  preposition: 'preposition',
  conjunction: 'conjunction',
  letter: 'letter',
  phrase: 'phrase',
  grammar_pattern: 'phrase',
};
// Never select one of several licenses and imply it covers the entire work.
// Complex/custom terms point to the native record; full snapshots also travel inline.
export function compatibilityLicense(
  values: OriginLicenseT[],
  nativeUrl: string,
): DictionaryApiLicenseT | undefined {
  const licenses = [...new Map(values.map((value) => [JSON.stringify(value), value])).values()];
  if (!licenses.length) return undefined;
  if (licenses.length === 1) return { name: licenses[0].name, url: licenses[0].url || nativeUrl };
  return { name: 'Multiple licenses — see vocabBloom terms', url: nativeUrl };
}
