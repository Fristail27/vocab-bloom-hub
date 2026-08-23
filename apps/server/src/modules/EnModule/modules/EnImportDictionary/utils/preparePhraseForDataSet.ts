import { DataSetPhraseT } from '../../../../../../types/dictionaries/en/EnDataSetTypes';
import { EnWord } from '../../../entities/en_word.entity';
import { EnPartOfSpeechE } from '../../../../../../types';
import { mapMeaningsForDS, mapShortTranslationForDS } from './prepareWordForDataSet';
import { sortShortTranslationsForDS, sortStrings } from './sortForDataSet';

export const preparePhraseForDataSet = (word: EnWord): DataSetPhraseT => {
  const { pattern: _p, form_of_word: _f, ...w } = word;
  return {
    categories: sortStrings(w.categories),
    generated: Boolean(w.generated),
    generated_by_model: w.generated_by_model || '',
    transcription: w.transcription || '',
    area_variant: w.area_variant || '',
    description: w.description || '',
    language_register: w.language_register || '',
    level: w.word_level || '',
    is_obsolete: Boolean(w.is_obsolete),
    phrase: w.word.word,
    meanings: mapMeaningsForDS(w.meanings, EnPartOfSpeechE.phrase),
    short_translations: sortShortTranslationsForDS(w.short_translations.map(mapShortTranslationForDS)),
    version: w.version,
  };
};
