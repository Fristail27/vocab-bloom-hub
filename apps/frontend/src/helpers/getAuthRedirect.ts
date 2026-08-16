const LOGIN_SEGMENT = 'login';

type LocaleRoutingT = {
  locales: readonly string[];
  defaultLocale: string;
};

/**
 * Decides where the middleware should redirect a request based on the auth
 * cookie. Returns the locale-aware login path for unauthenticated requests to
 * protected routes, or null when the request may pass through (the visitor is
 * authenticated or already heading to the login page).
 *
 * Only the cookie's presence is known at this point — token validity is still
 * enforced by the API and the client-side guard in Provider.
 */
export const getAuthRedirect = (
  pathname: string,
  hasAuthCookie: boolean,
  routing: LocaleRoutingT,
): string | null => {
  if (hasAuthCookie) return null;

  const segments = pathname.split('/').filter(Boolean);
  const hasLocalePrefix = routing.locales.includes(segments[0]);
  const locale = hasLocalePrefix ? segments[0] : routing.defaultLocale;
  const firstPathSegment = hasLocalePrefix ? segments[1] : segments[0];

  if (firstPathSegment === LOGIN_SEGMENT) return null;

  return `/${locale}/${LOGIN_SEGMENT}`;
};
