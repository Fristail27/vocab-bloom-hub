import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';
import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { SettingsController } from '../settings.controller';
import { AddSettingReqDTO } from '../dto/AddSettingReq.dto';

// Same options as the global pipe in main.ts
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const validateBody = (value: unknown) => pipe.transform(value, { type: 'body', metatype: AddSettingReqDTO });

describe('Settings DTO validation (issue #166)', () => {
  it('add and update body params are typed with AddSettingReqDTO, not Object', () => {
    const addParams: unknown[] = Reflect.getMetadata(
      'design:paramtypes',
      SettingsController.prototype,
      'addField',
    );
    const updateParams: unknown[] = Reflect.getMetadata(
      'design:paramtypes',
      SettingsController.prototype,
      'updateField',
    );
    expect(addParams[0]).toBe(AddSettingReqDTO);
    expect(updateParams[0]).toBe(AddSettingReqDTO);
  });

  it('accepts a valid { field, value } body', async () => {
    await expect(validateBody({ field: 'theme', value: 'dark' })).resolves.toBeInstanceOf(AddSettingReqDTO);
  });

  it('rejects unknown fields', async () => {
    await expect(validateBody({ field: 'theme', value: 'dark', extra: 'oops' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a missing or non-string value', async () => {
    await expect(validateBody({ field: 'theme' })).rejects.toThrow(BadRequestException);
    await expect(validateBody({ field: 'theme', value: 42 })).rejects.toThrow(BadRequestException);
  });
});
