import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { ImageResponse } from 'next/og';

// The home-screen icon of iOS and the icon of a few search results (issue
// #480): the logo on white, 180 × 180, generated at build time from the
// same SVG as the favicon. The path holds in the dev server, the build and
// the docker image alike (opengraph-image.tsx)
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const logo = `data:image/svg+xml;base64,${readFileSync(join(process.cwd(), 'public', 'logo.svg')).toString('base64')}`;

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain elements */}
      <img src={logo} width={132} height={132} alt="" />
    </div>,
    size,
  );
}
