import type { MetadataRoute } from 'next';

import { SITE_NAME } from '@/core/site';

// The web app manifest (issue #480): the name, the colours of the shell and
// the icons a browser or a search engine reads; the pages link it from the
// layout. English on purpose — one manifest for the eight interface languages
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description:
      'An open-source dictionary platform: a self-hosted English dictionary with a public read-only API, SDKs for Node.js and Python, an admin UI and a published dataset.',
    start_url: '/',
    display: 'browser',
    background_color: '#ffffff',
    theme_color: '#2b62d9',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
