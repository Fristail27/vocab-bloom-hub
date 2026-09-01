import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';

import { LocaleParamsP } from '@/types/common';

// The static social card of the site (issue #332): the logo, the name and
// the tagline, rendered per locale at build time. A per-word generated image
// is a possible follow-up, this one covers every page.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Vocab Bloom Hub';

// standalone's server.js chdirs next to itself, so the path holds in the
// dev server, the build and the docker image alike
const logo = `data:image/svg+xml;base64,${readFileSync(join(process.cwd(), 'public', 'logo.svg')).toString('base64')}`;

export default async function OpenGraphImage({ params }: LocaleParamsP) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '72px 88px',
        background: 'linear-gradient(135deg, #ffffff 0%, #eef3fb 100%)',
        color: '#1b1f24',
      }}
    >
      {/* the accent bar: a border on the root renders with corner artifacts in satori */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '14px',
          background: '#2b62d9',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '44px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain elements */}
        <img src={logo} width={180} height={180} alt="" />
        <div style={{ display: 'flex', fontSize: '78px' }}>{t('title')}</div>
      </div>
      <div style={{ display: 'flex', marginTop: '48px', fontSize: '31px', lineHeight: 1.45, color: '#59636e' }}>
        {t('description')}
      </div>
    </div>,
    size,
  );
}
