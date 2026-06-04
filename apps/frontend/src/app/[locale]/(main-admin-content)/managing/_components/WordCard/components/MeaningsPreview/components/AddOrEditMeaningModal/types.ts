import { EnMeaningT } from 'server/types';

export type AddOrEditStateT = {
  title: EnMeaningT['title'];
  definition: EnMeaningT['definition'];
  examples: EnMeaningT['examples'];
  sort_order: EnMeaningT['sort_order'];
  language_register: EnMeaningT['language_register'];
  meaning_level: EnMeaningT['meaning_level'];
  area_variant: EnMeaningT['area_variant'];
  is_obsolete: EnMeaningT['is_obsolete'];
  categories: EnMeaningT['categories'];
};
