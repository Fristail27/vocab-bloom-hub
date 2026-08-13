import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(__dirname, '../../../../.env') });
import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './modules/AppModule/app.module';
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';
import { getLogLevels } from './core/logging/get-log-levels';
import { checkIsPostgres } from '../configuration';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { logger: getLogLevels() });
  const httpServer = app.getHttpServer();
  httpServer.requestTimeout = 20 * 60 * 1000;
  httpServer.headersTimeout = 20 * 60 * 1000 + 1000; // должен быть чуть больше keepAliveTimeout
  httpServer.keepAliveTimeout = 20 * 60 * 1000;

  const config = new DocumentBuilder()
    .setTitle('VocabBloom API')
    .setDescription('API documentation for VocabBloom backend')
    .setVersion('1.0')
    .addBearerAuth() // если используешь JWT
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, document);

  app.enableCors({
    origin: [`http://localhost:3000`],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // удаляет лишние поля
      forbidNonWhitelisted: true, // ошибка если пришли лишние поля
      transform: true, // автопреобразование типов
    }),
  );
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));

  const port = process.env.SERVER_PORT || 3010;
  await app.listen(port);

  const isPostgres = checkIsPostgres();
  logger.log(`Server listening on port ${port}`);
  logger.log(
    `Database: ${isPostgres ? 'Postgres (DATABASE_URL)' : 'better-sqlite3 fallback (dev.sqlite)'}, synchronize=${process.env.NODE_ENV === 'development'}`,
  );
}
bootstrap();
