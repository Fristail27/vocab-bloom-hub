import { IconNamesT } from '@/core/ui/icons/types';

export enum IconSizeE {
  tiny = 'tiny',
  small = 'small',
  medium = 'medium',
  big = 'big',
  large = 'large',
}

export type IconP = {
  size?: keyof typeof IconSizeE;
  className?: string | undefined;
  name: IconNamesT;
  width?: number;
  height?: number;
  color?: string | undefined;
};
