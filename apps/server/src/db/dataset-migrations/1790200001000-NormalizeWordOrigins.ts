import type { MigrationInterface, QueryRunner } from 'typeorm';
import { normalizeStoredWordOrigins } from '../normalize-word-origins';

export class NormalizeWordOrigins1790200001000 implements MigrationInterface {
  name = 'NormalizeWordOrigins1790200001000';

  async up(runner: QueryRunner): Promise<void> {
    await normalizeStoredWordOrigins(runner.manager);
  }

  async down(): Promise<void> {
    // A terminology correction keeps its data when structural migrations are reverted.
  }
}
