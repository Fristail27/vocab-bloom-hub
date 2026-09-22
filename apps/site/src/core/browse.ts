import type { HeadwordIndexT } from './headwords';

// The browse index over the headwords (issue #480): a paged, server-rendered
// A–Z list a crawler can walk to every word page. It pages through the
// process's headword index — no request to the API per page

export const BROWSE_PAGE_SIZE = 200;
export const OTHER_BUCKET = 'other';
/** The buckets in order: the Latin letters, then everything else */
export const BROWSE_BUCKETS: readonly string[] = [...'abcdefghijklmnopqrstuvwxyz', OTHER_BUCKET];

/** The bucket of a headword: its first letter, `other` for a digit, a symbol or a non-Latin letter */
export const bucketOf = (word: string): string => {
  const first = word.trim().charAt(0).toLowerCase();
  return /^[a-z]$/.test(first) ? first : OTHER_BUCKET;
};

export const isBucket = (value: string): boolean => BROWSE_BUCKETS.includes(value);

// the headwords per bucket, computed once per index (the index changes once a day)
const bucketsCache = new WeakMap<HeadwordIndexT, Map<string, string[]>>();

export const bucketsOf = (index: HeadwordIndexT): Map<string, string[]> => {
  const cached = bucketsCache.get(index);
  if (cached) return cached;
  const buckets = new Map<string, string[]>();
  for (const word of index.words) {
    const bucket = bucketOf(word);
    const list = buckets.get(bucket);
    if (list) list.push(word);
    else buckets.set(bucket, [word]);
  }
  bucketsCache.set(index, buckets);
  return buckets;
};

export type BrowseBucketSummaryT = { bucket: string; count: number; pages: number };

/** Every bucket that has words, with its size, in the order of BROWSE_BUCKETS */
export const bucketSummaries = (index: HeadwordIndexT): BrowseBucketSummaryT[] => {
  const buckets = bucketsOf(index);
  return BROWSE_BUCKETS.filter((bucket) => buckets.has(bucket)).map((bucket) => {
    const count = buckets.get(bucket)?.length ?? 0;
    return { bucket, count, pages: Math.ceil(count / BROWSE_PAGE_SIZE) };
  });
};

export type BrowsePageT = { bucket: string; page: number; pages: number; count: number; words: string[] };

/** One page (1-based) of a bucket; null for an unknown bucket, an empty one or a page past the end */
export const browsePage = (index: HeadwordIndexT, bucket: string, page: number): BrowsePageT | null => {
  if (!isBucket(bucket) || !Number.isInteger(page) || page < 1) return null;
  const words = bucketsOf(index).get(bucket);
  if (!words) return null;
  const pages = Math.ceil(words.length / BROWSE_PAGE_SIZE);
  if (page > pages) return null;
  return {
    bucket,
    page,
    pages,
    count: words.length,
    words: words.slice((page - 1) * BROWSE_PAGE_SIZE, page * BROWSE_PAGE_SIZE),
  };
};

/** The page segment as a number: absent is the first page, anything else has to be a positive integer */
export const parsePage = (value: string | undefined): number | null => {
  if (value === undefined) return 1;
  if (!/^[1-9]\d{0,5}$/.test(value)) return null;
  return Number(value);
};

/** The route of a browse page without the locale: the first page has no page segment */
export const browsePath = (bucket: string, page = 1): string =>
  page > 1 ? `/word/browse/${bucket}/${page}` : `/word/browse/${bucket}`;
