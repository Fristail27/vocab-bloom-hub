import { Global, Module } from '@nestjs/common';
import { ImportStatusService } from './importStatus.service';

/**
 * The import slot and its status (issue #268). Global: EnModule writes it,
 * HealthModule reads it for the readiness probe — without a dependency
 * between the two.
 */
@Global()
@Module({
  providers: [ImportStatusService],
  exports: [ImportStatusService],
})
export class ImportStatusModule {}
