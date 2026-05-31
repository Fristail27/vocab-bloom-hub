import { ThemeE } from '@/types/common/index';

export type StateContextT = {
  isAuth: boolean;
  setIsAuth: (isAuth: boolean) => void;
  theme: ThemeE;
  setTheme: (v: ThemeE) => void;
};
