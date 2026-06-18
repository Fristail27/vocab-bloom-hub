import { EnVerbTransitivityE } from 'server/types';
import { TranslatorT } from '@/types/common';

export const getVerbTransitivityOptions = (t: TranslatorT) => [
  { value: EnVerbTransitivityE.transitive, label: t('transitive') },
  { value: EnVerbTransitivityE.intransitive, label: t('intransitive') },
  { value: EnVerbTransitivityE.both, label: t('both') },
];
