'use client';

import React from 'react';
import { ImportStatusT } from 'server/types';
import { EnApi } from '@/core/api/EnApi';

/**
 * The import slot of the server (issue #268): polled while an import runs
 * (the automatic one on first start, or one started from another session),
 * read once otherwise. `undefined` until the first answer arrives.
 */
export const useImportStatus = (pollMs = 3000): ImportStatusT | undefined => {
  const [status, setStatus] = React.useState<ImportStatusT | undefined>(undefined);

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      const res = await EnApi.getImportStatus();
      if (cancelled) return;
      const failed = !res || 'error' in res;
      if (!failed) setStatus(res);
      // keep polling while something runs (or until the first answer)
      if (failed || res.running) timer = setTimeout(tick, pollMs);
    };
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pollMs]);

  return status;
};
