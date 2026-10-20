import type { EnPartOfSpeechE } from './dictionaries';

export enum ReviewScopeE {
  definition = 'definition',
  meaning_translation = 'meaning_translation',
  short_translation = 'short_translation',
}
export enum ReviewStatusE {
  unchecked = 'unchecked',
  checked = 'checked',
  changed = 'changed',
}
export type ContentReviewT = {
  scope: ReviewScopeE;
  id: number;
  status: ReviewStatusE;
  checked_at: string | null;
  /** Exact content shown to the admin; checked again under a write lock. */
  expected: string;
};
export type SetContentReviewT = { checked: boolean; expected: string };
export type ReviewWordsQueryT = {
  scope: ReviewScopeE;
  status?: ReviewStatusE;
  search?: string;
  page?: number;
  limit?: number;
};
export type ReviewWordsT = {
  items: { id: number; word: string; part_of_speech: EnPartOfSpeechE; matches: number }[];
  total: number;
  page: number;
  limit: number;
  /** Counts of individual reviewable portions, not whole-word certification. */
  counts: Record<ReviewStatusE, number>;
};
