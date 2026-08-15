import { ErrorResT } from '../errors';
import { AddSettingReqDTO } from '../../src/modules/SettingsModule/dto/AddSettingReq.dto';

export type AddSettingResT = { success: boolean } | ErrorResT;
export type AddSettingReqT = AddSettingReqDTO;
export type GetAllSettingResT = Record<string, string> | ErrorResT;
