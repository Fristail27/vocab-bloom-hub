import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { AdminGuard } from '../AuthModule/guards/admin.guard';
import type { AddSettingReqT, AddSettingResT } from '../../../types/settings/SettingsApiTypes';

@Controller('/api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @UseGuards(AdminGuard)
  @Post('add')
  async addField(@Body() body: AddSettingReqT): Promise<AddSettingResT> {
    if (body.field === 'version') {
      return { success: false };
    }
    return this.settingsService.create(body.field, body.value);
  }

  @UseGuards(AdminGuard)
  @Get('all')
  async getAllSettings(): Promise<Record<string, string>> {
    return this.settingsService.findAll();
  }

  @UseGuards(AdminGuard)
  @Get('by-field/:fieldName')
  async getByFieldName(@Param('fieldName') fieldName: string): Promise<string> {
    if (fieldName === 'version') {
      return this.settingsService.getVersion() || '';
    }
    return this.settingsService.findOne(fieldName);
  }

  @UseGuards(AdminGuard)
  @Patch('update')
  async updateField(@Body() body: AddSettingReqT): Promise<AddSettingResT> {
    if (body.field === 'version') {
      return { success: false };
    }
    return this.settingsService.update(body.field, body.value);
  }

  @UseGuards(AdminGuard)
  @Delete('by-field/:fieldName')
  async deleteField(@Param('fieldName') fieldName: string): Promise<AddSettingResT> {
    if (fieldName === 'version') {
      return { success: false };
    }
    return this.settingsService.remove(fieldName);
  }
}
