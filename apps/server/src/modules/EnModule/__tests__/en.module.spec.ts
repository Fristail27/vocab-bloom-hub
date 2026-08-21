import 'reflect-metadata';
import { describe, expect, it } from '@jest/globals';

import { EnModule } from '../en.module';
import { EnMeaningController } from '../modules/EnMeaning/enMeaning.controller';
import { EnAdminListsController } from '../modules/EnAdminLists/enAdminLists.controller';
import { EnController } from '../en.controller';

describe('EnModule', () => {
  const controllers: unknown[] = Reflect.getMetadata('controllers', EnModule) ?? [];

  it('регистрирует EnMeaningController (issue #162)', () => {
    expect(controllers).toContain(EnMeaningController);
  });

  it('registers EnAdminListsController before EnController so its GET routes are not swallowed by /:id (issue #249)', () => {
    expect(controllers).toContain(EnAdminListsController);
    expect(controllers.indexOf(EnAdminListsController)).toBeLessThan(controllers.indexOf(EnController));
  });

  it('не содержит дубликатов контроллеров', () => {
    expect(new Set(controllers).size).toBe(controllers.length);
  });
});
