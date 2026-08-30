import 'server-only';

import type { PublicHeadwordV1ResT, PublicWordV1ResT } from 'server/types';

import { serverApiBase } from './apiBase';

// The word pages are rendered on the server from the instance's public API
// and cached for an hour: the dictionary changes rarely, a page is asked
// for often once it is indexed
const REVALIDATE_SECONDS = 3600;

export type HeadwordResultT =
  { kind: 'found'; result: PublicHeadwordV1ResT } | { kind: 'not_found' } | { kind: 'unavailable' };

/** GET /api/v1/words/{word}: every entry of a headword, or why there is none */
export const fetchHeadword = async (word: string): Promise<HeadwordResultT> => {
  try {
    const res = await fetch(`${serverApiBase()}/v1/words/${encodeURIComponent(word)}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (res.status === 404) return { kind: 'not_found' };
    if (!res.ok) return { kind: 'unavailable' };

    return { kind: 'found', result: (await res.json()) as PublicHeadwordV1ResT };
  } catch {
    return { kind: 'unavailable' };
  }
};

/** GET /api/v1/random: the headword of a random base-form entry, null when the API does not answer */
export const fetchRandomWord = async (): Promise<string | null> => {
  try {
    const res = await fetch(`${serverApiBase()}/v1/random`, { cache: 'no-store' });
    if (!res.ok) return null;

    return ((await res.json()) as PublicWordV1ResT).data.word;
  } catch {
    return null;
  }
};
