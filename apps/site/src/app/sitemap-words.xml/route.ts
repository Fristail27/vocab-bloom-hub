import { FIRST_WALK_WAIT_MS, headwordIndex, sitemapChunkCount } from '@/core/headwords';
import { siteUrl } from '@/core/site';
import { sitemapIndexXml, sitemapUnavailable, xmlResponse } from '@/core/sitemapXml';

// The word pages are the dictionary's long tail (issue #350), and their list
// only exists in the instance's database: this is a sitemap index over the
// headword index of the process (core/headwords.ts), one file per chunk of
// headwords (sitemap-words/<n>.xml). Dynamic — the API is unreachable during
// `next build` — and never empty: without an index yet the answer is a 503
// with Retry-After, which a crawler comes back from (issues #479, #480)
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const index = await headwordIndex.get({ waitMs: FIRST_WALK_WAIT_MS });
  if (!index) return sitemapUnavailable();
  const urls = Array.from(
    { length: sitemapChunkCount(index) },
    (_, chunk) => `${siteUrl()}/sitemap-words/${chunk}.xml`,
  );
  return xmlResponse(sitemapIndexXml(urls, index.lastModified));
}
