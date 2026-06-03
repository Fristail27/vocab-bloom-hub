import * as path from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
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

@Module({
  imports: [
    AuthModule,
    EnModule,
    TypeOrmModule.forRootAsync({
      useFactory: (): TypeOrmModuleOptions => {
        const databaseUrl = process.env.DATABASE_URL;

        const base = {
          entities: [EnEntry, EnWord, EnMeaning, EnMeaningTranslation, EnShortTranslation],
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
        };
      },
    }),
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
