import { AbstractBaseApi } from '../AbstractBaseApi';
import { AddSettingResT, GetAllSettingResT } from 'server/types/settings/SettingsApiTypes';

export class SettingsApi extends AbstractBaseApi {
  static async getSettings(): Promise<Record<string, string>> {
    const res = await this.get<GetAllSettingResT>(`${this.baseURL}/settings/all`);
    if (res.error) return {};
    return res as Record<string, string>;
  }

  static async getField(field: string): Promise<AddSettingResT> {
    return this.get<AddSettingResT>(`${this.baseURL}/settings/by-field/${field}`);
  }

  static async addField(field: string, value: string): Promise<AddSettingResT> {
    return this.post<AddSettingResT>(`${this.baseURL}/settings/add`, { field, value });
  }

  static async updateField(field: string, value: string): Promise<AddSettingResT> {
    return this.patch<AddSettingResT>(`${this.baseURL}/settings/update`, { field, value });
  }
  static async deleteField(field: string): Promise<AddSettingResT> {
    // the server route is by-field/:fieldName, same as getField (issue #347)
    return this.delete<AddSettingResT>(`${this.baseURL}/settings/by-field/${encodeURIComponent(field)}`);
  }
}
