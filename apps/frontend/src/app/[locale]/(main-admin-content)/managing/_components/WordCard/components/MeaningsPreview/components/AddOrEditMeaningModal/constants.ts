import { AddOrEditStateT } from './types';
import { EnAreaVariantsE, LanguageRegisterE } from 'server/types';

export const DefaultState: AddOrEditStateT = {
  title: '',
  definition: '',
  examples: [],
  categories: [],
  is_obsolete: false,
  sort_order: 0,
  meaning_level: null,
  area_variant: EnAreaVariantsE.common,
  language_register: LanguageRegisterE.formal,
};
