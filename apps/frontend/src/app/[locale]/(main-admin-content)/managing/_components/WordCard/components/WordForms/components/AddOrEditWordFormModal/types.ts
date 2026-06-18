import { EnWordFormT } from 'server/types';

export type ValuesStateT = {
  transcription: NonNullable<EnWordFormT['transcription']>;
  word: NonNullable<EnWordFormT['word']>;
  area_variant: NonNullable<EnWordFormT['area_variant']>;
};
