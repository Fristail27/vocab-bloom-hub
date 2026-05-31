import { ThemeE } from '@/types/common';

export const getThemeVariablesLink = (theme: ThemeE) => {
  return `/styles/${theme}_variables.css`;
};
