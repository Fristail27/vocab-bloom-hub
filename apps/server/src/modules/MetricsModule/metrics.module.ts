import { Global, Module } from '@nestjs/common';
import { EnModule } from '../EnModule/en.module';
import { MetricsService } from './metrics.service';

/**
 * Prometheus metrics (issue #281). Global, so the services that report
 * domain metrics (search tiers, dictionary transfers) inject MetricsService
 * without importing the module; the endpoint and the HTTP middleware are
 * wired by AppModule when METRICS_ENABLED is on.
 */
@Global()
@Module({
  imports: [EnModule],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
