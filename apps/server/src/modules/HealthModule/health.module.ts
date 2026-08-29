import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { ShutdownWatchdog } from './shutdown-watchdog';

/**
 * Probes and the shutdown watchdog (issue #315): what a process manager or
 * an orchestrator needs to run the server as a service.
 */
@Module({
  controllers: [HealthController],
  providers: [HealthService, ShutdownWatchdog],
  exports: [HealthService],
})
export class HealthModule {}
