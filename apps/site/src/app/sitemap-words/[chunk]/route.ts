import { FIRST_WALK_WAIT_MS, headwordIndex, sitemapChunk, sitemapChunkCount } from '@/core/headwords';
import { sitemapUnavailable, urlsetXml, xmlResponse } from '@/core/sitemapXml';

// One chunk of the word sitemap (issue #480): /sitemap-words/<n>.xml, every
// headword of the chunk in every interface language with its hreflang set
export const dynamic = 'force-dynamic';

type RouteContextT = { params: Promise<{ chunk: string }> };

export async function GET(_req: Request, { params }: RouteContextT): Promise<Response> {
  const { chunk } = await params;
  const match = /^(\d{1,4})\.xml$/.exec(chunk);
  if (!match) return new Response(null, { status: 404 });
  const index = await headwordIndex.get({ waitMs: FIRST_WALK_WAIT_MS });
  if (!index) return sitemapUnavailable();
  const number = Number(match[1]);
  if (number >= sitemapChunkCount(index)) return new Response(null, { status: 404 });
  const paths = sitemapChunk(index, number).map((word) => `/word/${encodeURIComponent(word)}`);
  return xmlResponse(urlsetXml(paths, index.lastModified));
}
