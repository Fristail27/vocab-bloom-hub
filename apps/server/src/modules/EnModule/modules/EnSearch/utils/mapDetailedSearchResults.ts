import { AvailableTranslationLanguagesE, EnWordT } from '../../../../../../types';
import { prepareWordForm } from '../../../utils/prepareWordForm';
import { prepareMeaningFromDB } from '../../../utils/prepareMeaningFromDB';
import { prepareShortTranslationFromDB } from '../../../utils/prepareTranslationsFromDB';
import { EnWord } from '../../../entities/en_word.entity';

type DetailedSearchOptionsT = {
  with_meanings: boolean;
  with_translations: boolean;
  translation_languages?: AvailableTranslationLanguagesE[] | undefined;
  // the fuzzy tier's score per word id; absent from exact answers
  similarity?: Map<number, number> | undefined;
};

export const mapDetailedSearchResults = (
  words: EnWord[],
  { with_meanings, with_translations, translation_languages, similarity }: DetailedSearchOptionsT,
): EnWordT[] => {
  const matchesLanguage = (language: AvailableTranslationLanguagesE) =>
    !translation_languages || translation_languages.includes(language);

  return words.map((w) => ({
    ...w,
    phrasal_variants: undefined,
    word: w.word.word,
    forms: (w.forms || [])?.map(prepareWordForm),
    meanings: with_meanings
      ? (w.meanings || []).map((m) => {
          const meaning = prepareMeaningFromDB(m);
          return { ...meaning, translations: meaning.translations.filter((t) => matchesLanguage(t.language)) };
        })
      : [],
    short_translations: with_translations
      ? (w.short_translations || [])
          .filter((t) => matchesLanguage(t.language))
          .map(prepareShortTranslationFromDB)
      : [],
    base_phrasal: w.base_phrasal?.word?.word,
    base_form: undefined,
    ...(similarity?.has(w.id) && { similarity: similarity.get(w.id) }),
  }));
};
