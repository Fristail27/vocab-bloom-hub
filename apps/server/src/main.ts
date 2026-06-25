import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './modules/AppModule/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
