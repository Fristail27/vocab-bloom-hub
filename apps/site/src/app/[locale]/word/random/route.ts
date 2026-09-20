import { fetchRandomWord } from '@/core/dictionary';

// `/en/word/random` → a random word's page; the index when the API does not answer
export const dynamic = 'force-dynamic';

type RouteContextT = { params: Promise<{ locale: string }> };

/**
 * The redirect is relative on purpose. Behind a reverse proxy the standalone
 * server sees its own address in `req.url` (`http://localhost:3020/…`), not
 * the public origin, so an absolute `Location` built from it sent the visitor
 * to localhost. A relative one is resolved by the browser against the URL it
 * asked — whatever host, scheme and port the proxy publishes (RFC 9110 §10.2.2).
 */
export const GET = async (_req: Request, { params }: RouteContextT): Promise<Response> => {
  const { locale } = await params;
  const word = await fetchRandomWord();
  const target = word ? `/${locale}/word/${encodeURIComponent(word)}` : `/${locale}/word`;

  return new Response(null, { status: 307, headers: { Location: target, 'Cache-Control': 'no-store' } });
};
