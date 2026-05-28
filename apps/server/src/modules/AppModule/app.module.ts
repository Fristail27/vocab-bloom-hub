import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';
import configuration from '../../../configuration';
import { AuthModule } from '../AuthModule/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL;
        if (databaseUrl) {
          return {
            type: 'postgres',
            url: databaseUrl,
            autoLoadEntities: true,
            synchronize: process.env.NODE_ENV === 'development',
          };
        }

        return {
          type: 'sqlite',
          database: path.join(process.cwd(), '..', '..', 'dev.sqlite'),
          autoLoadEntities: true,
          synchronize: process.env.NODE_ENV === 'development',
        };
      },
    }),
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
