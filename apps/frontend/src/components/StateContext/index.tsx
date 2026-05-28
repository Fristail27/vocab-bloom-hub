import { createContext } from 'react';
import { StateContextT } from '@/types/common/stateContext';

export const StateContext = createContext<StateContextT>({
  isAuth: false,
  setIsAuth: () => {},
});
