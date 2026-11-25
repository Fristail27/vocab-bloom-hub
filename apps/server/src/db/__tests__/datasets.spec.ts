import { expect, it } from '@jest/globals';
import { prepareDatabase } from '../datasets';
it('leaves development SQLite storage to synchronize', async () => {
  await expect(prepareDatabase()).resolves.toBeUndefined();
});
