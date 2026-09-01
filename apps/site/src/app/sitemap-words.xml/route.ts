import type { PublicWordsV1ResT } from 'server/types';

import { serverApiBase } from '@/core/apiBase';
import { siteUrl } from '@/core/site';
import { routing } from '@/i18n/routing';

// The word pages are the dictionary's long tail (issue #350), and their list
// only exists in the instance's database — this sitemap walks the public list
// API at request time. The API is unreachable during `next build`, so the
// route is dynamic with its own in-process cache instead of ISR.
export const dynamic = 'force-dynamic';

const CACHE_SECONDS = 24 * 3600;
// pages of 100 (the API's cap); 250 pages = up to 25k headwords ≤ the 50k-URL
// sitemap limit with two locales — a bounded window, not a full enumeration
const MAX_LIST_PAGES = 250;

let cached: { body: string; at: number } | null = null;

const collectHeadwords = async (): Promise<string[]> => {
  const words = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const query = new URLSearchParams({ limit: '100' });
    if (cursor) query.set('cursor', cursor);
    const res = await fetch(`${serverApiBase()}/v1/words?${query}`, { cache: 'no-store' });
    if (!res.ok) break;
    const { data, meta } = (await res.json()) as PublicWordsV1ResT;
    for (const entry of data) words.add(entry.word);
    if (!meta.next_cursor) break;
    cursor = meta.next_cursor;
  }
  return [...words];
};

const buildXml = (headwords: string[]): string => {
  const base = siteUrl();
  const urls = routing.locales.flatMap((locale) =>
    headwords.map((word) => `<url><loc>${base}/${locale}/word/${encodeURIComponent(word)}</loc></url>`),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`;
};

export async function GET(): Promise<Response> {
  if (!cached || Date.now() - cached.at > CACHE_SECONDS * 1000) {
    cached = { body: buildXml(await collectHeadwords()), at: Date.now() };
  }
  return new Response(cached.body, {
    headers: { 'content-type': 'application/xml', 'cache-control': `public, max-age=${CACHE_SECONDS}` },
  });
}
