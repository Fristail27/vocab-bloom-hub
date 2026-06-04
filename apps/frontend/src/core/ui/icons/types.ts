import icons from './index';

export type CommonIconP = {
  width?: number;
  height?: number;
  className?: string | undefined;
  color?: string | undefined;
};

export type IconNamesT = keyof typeof icons;
