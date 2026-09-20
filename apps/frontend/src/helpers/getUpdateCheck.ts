import { cache } from 'react';
import type { UpdateCheckT } from 'server/types/settings/SettingsApiTypes';
import { ServerSettingsApi } from '@/core/api/SettingsApi/ServerSettingsApi';

/**
 * The update check for a server render (issue #477): the root layout (the
 * footer) and the admin layout (the notice) ask for it in the same request, so
 * it is memoized per request. null when the admin is not signed in or the API
 * did not answer — the notice is then simply absent.
 */
export const getUpdateCheck = cache(async (): Promise<UpdateCheckT | null> => {
  const res = await ServerSettingsApi.getUpdateCheck();
  return 'error' in res && res.error ? null : (res as UpdateCheckT);
});
