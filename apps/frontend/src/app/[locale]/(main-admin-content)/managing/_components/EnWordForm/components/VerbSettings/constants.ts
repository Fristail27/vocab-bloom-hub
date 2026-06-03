import { EnPhrasalObjectPatternE, EnVerbTransitivityE } from 'server/types';

export const PhrasalObjectPatternsOfVerb = [
  { value: EnPhrasalObjectPatternE.no_object, label: 'no object' },
  { value: EnPhrasalObjectPatternE.inseparable, label: 'inseparable' },
  { value: EnPhrasalObjectPatternE.separable, label: 'separable' },
  { value: EnPhrasalObjectPatternE.separable_pronoun_only, label: 'separable pronoun only' },
];

export const TransitivityOptions = [
  { value: EnVerbTransitivityE.both, label: 'Both' },
  { value: EnVerbTransitivityE.transitive, label: 'transitive' },
  { value: EnVerbTransitivityE.intransitive, label: 'intransitive' },
];
