'use client';

import React, { useEffect } from 'react';

type GlobalErrorP = {
  error: Error & { digest?: string };
  retry: () => void;
};

// Last-resort boundary (issue #406): replaces the root layout when it throws.
// It renders outside the locale segment and without the global styles, so it
// carries its own document shell and both languages inline.
export default function GlobalError({ error, retry }: GlobalErrorP) {
  useEffect(() => {
    // eslint-disable-next-line no-console -- the boundary must not swallow the original error
    console.error(error);
  }, [error]);

  return (
    <html lang="en" style={{ colorScheme: 'light dark' }}>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '24px',
        }}
      >
        <h1 style={{ margin: 0 }}>Something went wrong</h1>
        <p style={{ margin: 0 }}>Что-то пошло не так.</p>
        <button
          type="button"
          onClick={retry}
          style={{ font: 'inherit', padding: '10px 18px', cursor: 'pointer' }}
        >
          Try again · Повторить
        </button>
      </body>
    </html>
  );
}
