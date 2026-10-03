import { EnWordT } from 'server/types';

export type CommonInfoDataT = Omit<
  EnWordT,
  | 'meanings'
  | 'forms'
  | 'short_translations'
  | 'part_of_speech'
  | 'word'
  | 'word_text'
  | 'origins'
  | 'licenses'
  | 'contributions'
  | 'copy_source'
>;

export enum StatusOfWordPresenceE {
  present = 'present',
  absent = 'absent',
  notChecked = 'notChecked',
}
