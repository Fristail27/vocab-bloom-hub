import { ErrorResT } from '../errors';
import { AddSettingReqDTO } from '../../src/modules/SettingsModule/dto/AddSettingReq.dto';

export type AddSettingResT = { success: boolean } | ErrorResT;
export type AddSettingReqT = AddSettingReqDTO;
export type GetAllSettingResT = Record<string, string> | ErrorResT;

/**
 * GET /api/settings/update-check (issue #477). `latest` and `release_url` are
 * null while unknown — the check is off (`enabled: false`), GitHub did not
 * answer, or the latest release carries no version tag; `update_available` is
 * then false, never an error.
 */
export type UpdateCheckT = {
  enabled: boolean;
  current: string;
  latest: string | null;
  update_available: boolean;
  release_url: string | null;
  checked_at: string | null;
};
export type UpdateCheckResT = UpdateCheckT;
export type GetUpdateCheckResT = UpdateCheckT | ErrorResT;
