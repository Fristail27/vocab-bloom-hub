import {
  CategoryE,
  EnAreaVariantsE,
  LanguageRegisterE,
  WordLevelE,
} from '../../../../../../../../server/types';
import { FormWordT } from './constants';
import { NounSettingsT } from './components/NounSettings/types';
import { VerbSettingsT } from './components/VerbSettings/types';

export type SubFormsT = {
  [key: string]: FormWordT[];
};

export type CommonInfoDataT = {
  generatedByModel: string;
  generated: boolean;
  is_abbreviation: boolean | undefined | null;
  category: CategoryE | null;
  description: string;
  transcription: string;
  language_register: LanguageRegisterE;
  is_obsolete: boolean;
  word_level: WordLevelE;
  area_variant: EnAreaVariantsE;
} & Partial<NounSettingsT> &
  Partial<VerbSettingsT>;

export enum StatusOfWordPresenceE {
  present = 'present',
  absent = 'absent',
  notChecked = 'notChecked',
  loading = 'loading',
  error = 'error',
}
