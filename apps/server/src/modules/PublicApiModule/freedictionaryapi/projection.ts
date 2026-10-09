import type { PublicWordV1T } from '../../../../types';
import { AvailableTranslationLanguagesE, CategoryE, EnAreaVariantsE, EnWordFormsE } from '../../../../types';
import type { FreeDictionaryEntryT, FreeDictionarySenseT } from '../../../../types/public/freedictionaryapi';
import { licensesOf } from '../../../../core/utils/provenance';
import { orderedPronunciations } from '../../EnModule/utils/pronunciations';
import { COMPATIBILITY_POS } from '../utils/compatibility';

export const ENGLISH = { code: 'en', name: 'English' };
const LANGUAGE_NAMES: Record<AvailableTranslationLanguagesE, string> = {
  ru: 'Russian',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  zh: 'Chinese',
  ar: 'Arabic',
};
const CATEGORY: Record<CategoryE, string> = {
  scientific: 'scientific',
  technical: 'technical',
  medical: 'medical',
  legal: 'legal',
  business: 'business',
  IT: 'computing',
  art: 'art',
  political: 'political',
  sport: 'sport',
  culinary: 'culinary',
};
const REGION: Record<EnAreaVariantsE, string[]> = {
  common: [],
  british: ['British'],
  american: ['American'],
  australian: ['Australian'],
};
export const FORM_TAGS: Record<EnWordFormsE, string[]> = {
  base_form: ['canonical'],
  plural_form: ['plural'],
  possessive_singular_form: ['possessive', 'singular'],
  possessive_plural_form: ['plural', 'possessive'],
  past_simple: ['past'],
  past_participle: ['participle', 'past'],
  present_participle: ['participle', 'present'],
  third_person_singular: ['present', 'singular', 'third-person'],
  comparative_form: ['comparative'],
  superlative_form: ['superlative'],
  object: ['object'],
  possessive_adjective: ['possessive', 'attributive'],
  possessive_pronoun: ['possessive'],
  reflexive: ['reflexive'],
  ordinal: ['ordinal'],
  multiplicative: ['multiplicative'],
};
const unique = (values: string[]): string[] => [...new Set(values.filter(Boolean))].sort();
const region = (value: EnAreaVariantsE | null | undefined): string[] => (value ? REGION[value] : []);

export function toFreeDictionaryEntries(
  entries: PublicWordV1T[],
  requested: string,
  dataset: string,
  translations: boolean,
): FreeDictionaryEntryT[] {
  return entries.map((entry) => {
    const form = entry.forms.find((form) => form.word === requested);
    const pronunciations = form?.pronunciations ?? entry.pronunciations ?? [];
    const senses: FreeDictionarySenseT[] = entry.meanings.map((meaning) => ({
      definition: meaning.definition,
      tags: unique([
        ...region(meaning.area_variant === EnAreaVariantsE.common ? entry.area_variant : meaning.area_variant),
        ...(meaning.is_obsolete || entry.is_obsolete ? ['obsolete'] : []),
        ...((meaning.language_register ?? entry.language_register)
          ? [meaning.language_register ?? entry.language_register!]
          : []),
        ...(entry.noun___uncountable ? ['uncountable'] : []),
        ...(entry.verb___transitivity === 'both'
          ? ['transitive', 'intransitive']
          : entry.verb___transitivity
            ? [entry.verb___transitivity]
            : []),
        ...[...entry.categories, ...meaning.categories].map((category) => CATEGORY[category]),
      ]),
      examples: [...meaning.examples],
      quotes: (meaning.quotes ?? []).map((quote) => ({
        text: quote.text,
        reference: [quote.reference, quote.source_url].filter(Boolean).join(' '),
      })),
      synonyms: unique(meaning.synonyms),
      antonyms: unique(meaning.antonyms),
      ...(translations && {
        translations: meaning.translations.flatMap((translation) => {
          const name = LANGUAGE_NAMES[translation.language];
          return name
            ? unique(translation.variants_of_words).map((word) => ({
                language: { code: translation.language, name },
                word,
              }))
            : [];
        }),
      }),
      subsenses: [],
    }));
    const forms = [
      ...(entry.word !== requested ? [{ word: entry.word, tags: ['canonical'] }] : []),
      ...entry.forms.map((form) => ({
        word: form.word,
        tags: unique([...FORM_TAGS[form.form_of_word], ...region(form.area_variant)]),
      })),
      ...[...(entry.alternatives ?? [])].sort().map((word) => ({ word, tags: ['alternative'] })),
    ];
    const origins = entry.origins ?? [];
    const contributions = entry.contributions ?? [];
    return {
      language: ENGLISH,
      partOfSpeech: COMPATIBILITY_POS[entry.part_of_speech],
      pronunciations: orderedPronunciations(pronunciations).flatMap((value) =>
        value.text ? [{ type: value.type, text: value.text, tags: region(value.area_variant) }] : [],
      ),
      forms: [...new Map(forms.map((form) => [JSON.stringify(form), form])).values()],
      senses,
      synonyms: unique(senses.flatMap((sense) => sense.synonyms)),
      antonyms: unique(senses.flatMap((sense) => sense.antonyms)),
      vocabBloom: {
        dataset,
        word: entry.word,
        source: entry.source ?? '',
        modified: entry.modified ?? false,
        origins,
        contributions,
        licenses: licensesOf([...origins, ...contributions]),
      },
    };
  });
}
