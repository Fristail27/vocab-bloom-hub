import { EnAreaVariantsE, EnMeaningT, LanguageRegisterE, WordLevelE } from 'server/types';

export const DefaultMeaningData: EnMeaningT = {
  title: '',
  meaning_level: WordLevelE.A1,
  sort_order: 0,
  examples: [],
  area_variant: EnAreaVariantsE.common,
  categories: [],
  definition: '',
  is_obsolete: false,
  language_register: LanguageRegisterE.formal,
  id: 0,
  translations: [],
};
