import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as path from 'path';
import configuration from '../../../configuration';
import { AuthModule } from '../AuthModule/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forRootAsync({
      useFactory: (): TypeOrmModuleOptions => {
        const databaseUrl = process.env.DATABASE_URL;

        const base = {
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
