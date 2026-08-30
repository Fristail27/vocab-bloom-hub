import { NextResponse } from 'next/server';

import { fetchRandomWord } from '@/core/dictionary';

// `/en/word/random` → a random word's page; the index when the API does not answer
export const dynamic = 'force-dynamic';

type RouteContextT = { params: Promise<{ locale: string }> };

export const GET = async (req: Request, { params }: RouteContextT): Promise<Response> => {
  const { locale } = await params;
  const word = await fetchRandomWord();
  const target = word ? `/${locale}/word/${encodeURIComponent(word)}` : `/${locale}/word`;

  return NextResponse.redirect(new URL(target, req.url), 307);
};
