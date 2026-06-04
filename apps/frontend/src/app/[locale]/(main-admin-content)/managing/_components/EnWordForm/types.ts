import { EnWordT } from 'server/types';

export type CommonInfoDataT = Omit<
  EnWordT,
  'meanings' | 'forms' | 'short_translations' | 'part_of_speech' | 'word' | 'word_text'
>;

export enum StatusOfWordPresenceE {
  present = 'present',
  absent = 'absent',
  notChecked = 'notChecked',
  loading = 'loading',
  error = 'error',
}
