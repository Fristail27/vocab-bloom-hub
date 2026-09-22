import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// The security headers of the admin UI (issue #479): the app sets them
// itself so every installation has them, with or without a reverse proxy.
// Framing is refused outright — the admin panel has no reason to be embedded
// and clickjacking is the attack it needs protecting from. HSTS belongs to
// the TLS terminator (docs/deployment/reverse-proxy.md), not to plain http
export const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  env: {
    PORT: process.env.FRONT_PORT || '3000',
  },
  // A self-contained build for the Docker image (issue #316): .next/standalone
  // holds server.js and only the node_modules the app needs. The tracing root
  // is the monorepo root so the hoisted node_modules are found; the output then
  // lives under .next/standalone/apps/frontend
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(nextConfig);
