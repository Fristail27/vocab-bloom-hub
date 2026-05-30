import { EnPhrasalObjectPatternE, EnVerbTransitivityE } from 'server/types';

export type VerbSettingsT = {
  verb___is_irregular?: boolean;
  verb___transitivity: EnVerbTransitivityE;
  verb___is_phrasal: boolean;
  base_phrasal: string;
  verb___phrasal_object_pattern: EnPhrasalObjectPatternE;
};
