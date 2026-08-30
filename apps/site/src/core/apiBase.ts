import { apiTarget } from './apiProxy';

/**
 * Where the public API is, from the browser: NEXT_PUBLIC_BASE_API_URL,
 * inlined at build time; a relative value (the default `/api`) is resolved
 * against the page origin — "the API is served under this origin", by the
 * reverse proxy or by the site's own forwarding route
 */
export const browserApiBase = (): string => {
  const configured = process.env.NEXT_PUBLIC_BASE_API_URL || '/api';
  if (typeof window !== 'undefined' && !/^[a-z][a-z0-9+.-]*:\/\//i.test(configured)) {
    return new URL(configured, window.location.origin).toString().replace(/\/$/, '');
  }

  return configured.replace(/\/$/, '');
};

/** Where the public API is, from the site's server process (server-side rendering of the word pages) */
export const serverApiBase = (): string => apiTarget();
