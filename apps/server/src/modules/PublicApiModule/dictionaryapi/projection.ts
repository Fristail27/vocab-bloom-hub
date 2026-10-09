import type { OriginLicenseT, PublicWordV1T } from '../../../../types';
import { EnPartOfSpeechE } from '../../../../types';
import type {
  DictionaryApiLicenseT,
  DictionaryApiPhoneticT,
  DictionaryApiV1ResT,
  DictionaryApiV2ResT,
} from '../../../../types/public/dictionaryapi';
import { orderedPronunciations, primaryIPA } from '../../EnModule/utils/pronunciations';
import { orderedAudio } from '../../EnModule/utils/pronunciationAudio';

const POS: Record<EnPartOfSpeechE, string> = {
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
const unique = (values: string[]): string[] => [...new Set(values.filter(Boolean))].sort();

// Never select one of several licenses and imply it covers the entire work.
// Complex/custom terms point to the native record; full snapshots also travel inline.
function licenseOf(values: OriginLicenseT[], nativeUrl: string): DictionaryApiLicenseT | undefined {
  const licenses = [...new Map(values.map((value) => [JSON.stringify(value), value])).values()];
  if (!licenses.length) return undefined;
  if (licenses.length === 1) return { name: licenses[0].name, url: licenses[0].url || nativeUrl };
  return { name: 'Multiple licenses — see vocabBloom terms', url: nativeUrl };
}

/** One array item per native entry: entries with different provenance are never merged. */
export function toDictionaryApiV2(
  entries: PublicWordV1T[],
  dataset = 'default',
  baseUrl = '',
): DictionaryApiV2ResT {
  return entries.map((entry) => {
    const nativeUrl = `${baseUrl}/api/v1/words/${encodeURIComponent(entry.word)}/datasets`;
    const origins = entry.origins ?? [];
    const contributions = entry.contributions ?? [];
    const terms = [...origins, ...contributions];
    const licenses = terms.flatMap((origin) => origin.licenses);
    const license = licenseOf(licenses, nativeUrl);
    const pronunciations = orderedPronunciations(entry.pronunciations ?? []);
    const phonetics: DictionaryApiPhoneticT[] = pronunciations.flatMap<DictionaryApiPhoneticT>(
      (pronunciation) => {
        const text = pronunciation.type === 'ipa' && pronunciation.text ? pronunciation.text : undefined;
        const recordings = orderedAudio(pronunciation.audio ?? []);
        if (!recordings.length) return text ? [{ text, audio: '' }] : [];
        return recordings.map((recording) => {
          const audioLicense = licenseOf(recording.licenses, nativeUrl);
          return {
            ...(text && { text }),
            audio: recording.url,
            ...(recording.source_url && { sourceUrl: recording.source_url }),
            ...(audioLicense && { license: audioLicense }),
            vocabBloom: { attribution: recording.attribution ?? null, licenses: recording.licenses },
          };
        });
      },
    );
    const phonetic = primaryIPA(pronunciations);
    const origin = [...(entry.etymologies ?? [])]
      .sort((a, b) => a.number - b.number)
      .map((value) => value.text)
      .filter(Boolean)
      .join('\n\n');
    const definitions = entry.meanings.map((meaning) => ({
      definition: meaning.definition,
      synonyms: unique(meaning.synonyms),
      antonyms: unique(meaning.antonyms),
      ...(meaning.examples.find(Boolean) && { example: meaning.examples.find(Boolean) }),
    }));
    return {
      word: entry.word,
      ...(phonetic && { phonetic }),
      phonetics,
      ...(origin && { origin }),
      meanings: [
        {
          partOfSpeech: POS[entry.part_of_speech],
          definitions,
          synonyms: unique(definitions.flatMap((value) => value.synonyms)),
          antonyms: unique(definitions.flatMap((value) => value.antonyms)),
        },
      ],
      ...(license && { license }),
      sourceUrls: unique([
        ...terms.flatMap((value) => [value.record_url ?? '', value.url ?? '']),
        nativeUrl,
        ...(entry.modified
          ? [
              `${baseUrl}/api/v1/words/${encodeURIComponent(entry.word)}/datasets/${encodeURIComponent(dataset)}/history`,
            ]
          : []),
      ]),
      vocabBloom: {
        dataset,
        source: entry.source ?? '',
        modified: entry.modified ?? false,
        origins,
        contributions,
        licenses: entry.licenses ?? [],
      },
    };
  });
}

export function toDictionaryApiV1(
  entries: PublicWordV1T[],
  dataset = 'default',
  baseUrl = '',
): DictionaryApiV1ResT {
  return toDictionaryApiV2(entries, dataset, baseUrl).map(({ meanings, ...entry }) => ({
    ...entry,
    meaning: Object.fromEntries(meanings.map((meaning) => [meaning.partOfSpeech, meaning.definitions])),
  }));
}
