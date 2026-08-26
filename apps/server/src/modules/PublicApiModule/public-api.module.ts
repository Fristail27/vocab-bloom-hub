import { Module } from '@nestjs/common';
import { EnModule } from '../EnModule/en.module';
import { PublicSearchController } from './public-search.controller';

/**
 * The public, read-only, versioned surface of the dictionary (`/api/v1`,
 * issue #271): no authentication, nothing that mutates data, one rate
 * limit for the whole prefix. Backed by the same services as the admin API.
 */
@Module({
  imports: [EnModule],
  controllers: [PublicSearchController],
})
export class PublicApiModule {}
