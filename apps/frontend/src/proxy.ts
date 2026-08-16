import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';
import { getAuthRedirect } from './helpers/getAuthRedirect';

const intlMiddleware = createMiddleware(routing);

// Unauthenticated visitors are redirected to the login page before any server
// component runs, instead of rendering an empty UI and bouncing on the client.
// Only the presence of the httpOnly bearer cookie is checked here; token
// validity is still enforced by the API, and the client-side guard in Provider
// stays as a safety net for expired/invalid tokens.
export default function proxy(request: NextRequest) {
  const redirectPath = getAuthRedirect(request.nextUrl.pathname, request.cookies.has('bearer'), routing);

  if (redirectPath) {
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
