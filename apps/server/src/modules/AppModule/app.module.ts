import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from '../../../configuration';
import { AuthModule } from '../AuthModule/auth.module';

@Module({
  imports: [
      AuthModule,
    // TypeOrmModule.forRootAsync({
    //   imports: [ConfigModule],
    //   useFactory: (config: ConfigService) => ({
    //     ...config.get('database'),
    //     entities: [],
    //     synchronize: true // ⚠️ только для разработки!,
    //   }),
    //   inject: [ConfigService]
    // }),
    ConfigModule.forRoot({isGlobal: true, load: [configuration]})
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
