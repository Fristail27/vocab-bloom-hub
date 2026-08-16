import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from '../../../configuration';
import { AuthModule } from '../AuthModule/auth.module';
import { EnModule } from '../EnModule/en.module';
import { SettingsModule } from '../SettingsModule/settings.module';
import { buildTypeOrmOptions } from '../../db/typeorm-options';

@Module({
  imports: [
    AuthModule,
    EnModule,
    SettingsModule,
    // Лимиты по умолчанию; на эндпоинтах уточняются через @Throttle.
    // Гвард (AppThrottlerGuard) вешается точечно на login и search.
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
export class AppModule {}
