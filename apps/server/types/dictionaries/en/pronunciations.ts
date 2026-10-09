import type { OriginLicenseT } from '../../provenance';
import type { EnAreaVariantsE } from './index';

/** Portable pronunciation; database IDs never travel in datasets or public responses. */
export type PronunciationT = {
  /** Recordings carry their own terms, independent of the word's text. */
  audio?: PronunciationAudioT[];
  type: 'ipa' | 'enpr';
  text: string | null;
  area_variant: EnAreaVariantsE;
  /** @asType integer */
  sort_order: number;
};

/** External recordings only; missing license metadata is an empty list, never the text license. */
export type PronunciationAudioT = {
  url: string;
  source_url?: string | null;
  attribution?: string | null;
  licenses: OriginLicenseT[];
  /** @asType integer */
  sort_order: number;
};

export type AdminPronunciationT = Omit<PronunciationT, 'audio'> & {
  id?: number;
  audio?: (PronunciationAudioT & { id?: number })[];
};
