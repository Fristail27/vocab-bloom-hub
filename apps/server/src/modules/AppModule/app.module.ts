import * as path from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from '../../../configuration';
import { AuthModule } from '../AuthModule/auth.module';
import { EnModule } from '../EnModule/en.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EnWord } from '../EnModule/entities/en_word.entity';
import { EnMeaning } from '../EnModule/entities/en_meaning.entity';
import { EnMeaningTranslation } from '../EnModule/entities/en_meaning_translation.entity';
import { EnEntry } from '../EnModule/entities/en_entry.entity';
import { EnShortTranslation } from '../EnModule/entities/en_short_translation.entity';
import { SettingsModule } from '../SettingsModule/settings.module';
import { Settings } from '../SettingsModule/entities/settings.entity';

@Module({
  imports: [
    AuthModule,
    EnModule,
    SettingsModule,
    // Лимиты по умолчанию; на эндпоинтах уточняются через @Throttle.
    // Гвард (AppThrottlerGuard) вешается точечно на login и search.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 100 }] }),
    TypeOrmModule.forRootAsync({
      useFactory: (): TypeOrmModuleOptions => {
        const databaseUrl = process.env.DATABASE_URL;

        const base = {
          entities: [EnEntry, EnWord, EnMeaning, EnMeaningTranslation, EnShortTranslation, Settings],
          autoLoadEntities: true,
          synchronize: process.env.NODE_ENV === 'development',
        };

        if (databaseUrl) {
          return {
            ...base,
            type: 'postgres',
            url: databaseUrl,
          };
        }

        return {
          ...base,
          type: 'better-sqlite3',
          database: path.join(process.cwd(), '..', '..', 'dev.sqlite'),
          prepareDatabase: (db) => {
            db.pragma('foreign_keys = ON');
          },
        };
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
