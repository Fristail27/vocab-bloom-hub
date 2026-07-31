import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings } from './entities/settings.entity';
import { ErrorCodes } from '../../../core/constants/error_codes';
import { AddSettingResT } from '../../../types/settings/SettingsApiTypes';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Settings)
    private readonly settingsRepository: Repository<Settings>,

    private readonly configService: ConfigService,
  ) {}

  getVersion() {
    return this.configService.get<string>('version');
  }

  async findAll(): Promise<Record<string, string>> {
    const dbRes = await this.settingsRepository.find({ order: { field: 'ASC' } });
    const settings: Record<string, string> = {};
    dbRes.forEach((db) => {
      settings[db.field] = db.value;
    });
    settings.version = this.getVersion() || '';
    return settings;
  }

  async findOne(field: string): Promise<string> {
    const setting = await this.settingsRepository.findOne({ where: { field } });

    if (!setting) {
      throw new NotFoundException(ErrorCodes.setting_field_doesnt_found);
    }

    return setting.value;
  }

  async create(field: string, value: string): Promise<AddSettingResT> {
    const exists = await this.settingsRepository.exists({ where: { field } });

    if (exists) {
      throw new ConflictException(ErrorCodes.setting_field_already_exists);
    }

    await this.settingsRepository.save({ field, value });

    return { success: true };
  }

  async update(field: string, value: string): Promise<AddSettingResT> {
    const setting = await this.settingsRepository.findOne({ where: { field } });
    if (!setting) {
      throw new NotFoundException(ErrorCodes.setting_field_doesnt_found);
    }
    setting.value = value;

    await this.settingsRepository.save(setting);
    return { success: true };
  }

  async remove(field: string): Promise<AddSettingResT> {
    const result = await this.settingsRepository.delete({ field });

    if (!result.affected) {
      throw new NotFoundException(ErrorCodes.setting_field_doesnt_found);
    }

    return { success: true };
  }
}
