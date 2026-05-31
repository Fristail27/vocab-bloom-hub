import { createContext } from 'react';
import { StateContextT } from '@/types/common/stateContext';
import { ThemeE } from '@/types/common';

export const StateContext = createContext<StateContextT>({
  isAuth: false,
  setIsAuth: () => {},
  theme: ThemeE.light,
  setTheme: () => {},
});
