import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';

import { EnModule } from '../en.module';
import { EnMeaningController } from '../modules/EnMeaning/enMeaning.controller';

describe('EnModule', () => {
  const controllers: unknown[] = Reflect.getMetadata('controllers', EnModule) ?? [];

  it('регистрирует EnMeaningController (issue #162)', () => {
    expect(controllers).toContain(EnMeaningController);
  });

  it('не содержит дубликатов контроллеров', () => {
    expect(new Set(controllers).size).toBe(controllers.length);
  });
});
