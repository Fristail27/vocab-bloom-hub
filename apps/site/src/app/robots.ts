import type { MetadataRoute } from 'next';

import { siteUrl } from '@/core/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/'] },
    // the static pages, and the dictionary's word pages walked from the API
    sitemap: [`${siteUrl()}/sitemap.xml`, `${siteUrl()}/sitemap-words.xml`],
  };
}
