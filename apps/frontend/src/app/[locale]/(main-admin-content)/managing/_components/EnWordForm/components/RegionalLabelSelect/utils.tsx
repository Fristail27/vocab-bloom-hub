import { EnAreaVariantsE } from 'server/types';
import { TranslatorT } from '@/types/common';

export const getRegionalLabelOptions = (t: TranslatorT) => [
  { value: EnAreaVariantsE.common, label: t('regional_common'), icons: ['internationalFlag' as const] },
  { value: EnAreaVariantsE.british, label: t('regional_british'), icons: ['britishFlag' as const] },
  {
    value: EnAreaVariantsE.american,
    label: t('regional_american'),
    icons: ['usaFlag' as const],
  },
  { value: EnAreaVariantsE.australian, label: t('regional_australian'), icons: ['australianFlag' as const] },
];
