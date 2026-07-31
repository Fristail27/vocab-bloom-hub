import { ErrorResT } from '../errors';

export type AddSettingResT = { success: boolean } | ErrorResT;
export type AddSettingReqT = { field: string; value: string };
export type GetAllSettingResT = Record<string, string> | ErrorResT;
