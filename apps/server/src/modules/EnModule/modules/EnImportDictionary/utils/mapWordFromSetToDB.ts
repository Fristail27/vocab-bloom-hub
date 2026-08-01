import { DataSetWordT } from '../../../../../../types/dictionaries/en/EnDataSetTypes';
import { EnAreaVariantsE, EnWordFormsE, LanguageRegisterE } from '../../../../../../types';
import { getVersion } from '../../../../../../configuration';

export const mapWordFromSetToDB = (line: DataSetWordT) => {
  return {
    word: line.word,
    part_of_speech: line.part_of_speech,
    pattern: null,
    form_of_word: EnWordFormsE.base_form,
    area_variant: line.area_variant || EnAreaVariantsE.common,
    generated_by_model: line.generated_by_model,
    generated: !!line.generated,
    verb___phrasal_object_pattern: line.verb___phrasal_object_pattern || null,
    verb___transitivity: line.verb___transitivity || null,
    language_register: line.language_register || LanguageRegisterE.formal,
    categories: line.categories || [],
    verb___is_phrasal: !!line.verb___is_phrasal,
    verb___is_irregular: !!line.verb___is_irregular,
    noun___is_proper: !!line.noun___is_proper,
    word_level: line.word_level || null,
    description: line.description,
    transcription: line.transcription,
    is_obsolete: line.is_obsolete,
    version: line.version || getVersion(),
    is_abbreviation: line.is_abbreviation,
    noun___uncountable: line.noun___uncountable,
    noun___irregular_plural: line.noun___irregular_plural,
    id: 0,
    noun___always_plural: line.noun___always_plural,
    base_phrasal: undefined,
    base_form: undefined,
    phrasal_variants: [],
    forms: line.forms.map((w) => ({ ...w, id: 0 })),
    short_translations: line.short_translations.map((s) => ({ id: 0, ...s })),
    meanings: line.meanings.map((m) => ({
      ...m,
      id: 0,
      meaning_level: m.meaning_level || null,
      language_register: m.language_register || LanguageRegisterE.formal,
      area_variant: m.area_variant || EnAreaVariantsE.common,
      translations: m.translations.map((t) => ({ id: 0, ...t })),
    })),
  };
};
