import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from '../../../configuration';
import { AuthModule } from '../AuthModule/auth.module';
import { EnModule } from '../EnModule/en.module';
import { SettingsModule } from '../SettingsModule/settings.module';
import { PublicApiModule } from '../PublicApiModule/public-api.module';
import { apiSurfaceMiddleware } from '../../core/middleware/api-surface.middleware';
import { buildTypeOrmOptions } from '../../db/typeorm-options';

@Module({
  imports: [
    AuthModule,
    EnModule,
    SettingsModule,
    PublicApiModule,
    // Default limits; endpoints refine them through @Throttle. The guard
    // (AppThrottlerGuard) is attached to login, the legacy search aliases and
    // the whole public prefix (PUBLIC_API_RATE_LIMIT).
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 100 }] }),
    TypeOrmModule.forRootAsync({
      useFactory: buildTypeOrmOptions,
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // version header on the public prefix and the PUBLIC_API_ENABLED /
    // ADMIN_API_ENABLED switches; runs before routing so 404s are covered too
    consumer.apply(apiSurfaceMiddleware).forRoutes('*');
  }
}
