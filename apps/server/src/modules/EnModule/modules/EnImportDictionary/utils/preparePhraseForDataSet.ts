import { DataSetPhraseT } from '../../../../../../types/dictionaries/en/EnDataSetTypes';
import { EnWord } from '../../../entities/en_word.entity';
import { mapMeaningForDS, mapShortTranslationForDS } from './prepareWordForDataSet';

export const preparePhraseForDataSet = (word: EnWord): DataSetPhraseT => {
  const { pattern: _p, form_of_word: _f, ...w } = word;
  return {
    categories: w.categories || [],
    generated: Boolean(w.generated),
    generated_by_model: w.generated_by_model || '',
    transcription: w.transcription || '',
    area_variant: w.area_variant || '',
    description: w.description || '',
    language_register: w.language_register || '',
    level: w.word_level || '',
    is_obsolete: Boolean(w.is_obsolete),
    phrase: w.word.word,
    meanings: w.meanings.map(mapMeaningForDS) || [],
    short_translations: w.short_translations.map(mapShortTranslationForDS) || [],
    version: w.version,
  };
};
