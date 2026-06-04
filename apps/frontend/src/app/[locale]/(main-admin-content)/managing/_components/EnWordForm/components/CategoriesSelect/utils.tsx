import { CategoryE } from 'server/types';
import { TranslatorT } from '@/types/common';

export const getCategoryOptions = (t: TranslatorT) => [
  { value: CategoryE.scientific, label: t(`cat_${CategoryE.scientific}`) },
  { value: CategoryE.technical, label: t(`cat_${CategoryE.technical}`) },
  { value: CategoryE.medical, label: t(`cat_${CategoryE.medical}`) },
  { value: CategoryE.legal, label: t(`cat_${CategoryE.legal}`) },
  { value: CategoryE.business, label: t(`cat_${CategoryE.business}`) },
  { value: CategoryE.IT, label: t(`cat_${CategoryE.IT}`) },
  { value: CategoryE.art, label: t(`cat_${CategoryE.art}`) },
  { value: CategoryE.political, label: t(`cat_${CategoryE.political}`) },
  { value: CategoryE.sport, label: t(`cat_${CategoryE.sport}`) },
  { value: CategoryE.culinary, label: t(`cat_${CategoryE.culinary}`) },
];
