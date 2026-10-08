import type { EnAreaVariantsE } from './index';

/** Portable pronunciation; database IDs never travel in datasets or public responses. */
export type PronunciationT = {
  type: 'ipa' | 'enpr';
  text: string | null;
  area_variant: EnAreaVariantsE;
  /** @asType integer */
  sort_order: number;
};
