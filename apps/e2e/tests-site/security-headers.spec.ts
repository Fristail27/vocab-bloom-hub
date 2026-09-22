import { expect, test } from '@playwright/test';

// The security headers the website sends by itself (issue #479), on a
// prerendered page, a regenerated one and a route handler alike
test('every answer carries the security headers', async ({ request }) => {
  for (const path of ['/en', '/en/docs/api', '/en/word/run', '/sitemap.xml', '/robots.txt']) {
    const headers = (await request.get(path)).headers();
    expect(headers['x-content-type-options'], path).toBe('nosniff');
    expect(headers['x-frame-options'], path).toBe('SAMEORIGIN');
    expect(headers['content-security-policy'], path).toBe("frame-ancestors 'self'");
    expect(headers['referrer-policy'], path).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy'], path).toContain('camera=()');
  }
});
