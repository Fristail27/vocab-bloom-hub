import { config } from 'dotenv';
import path from 'path';
// The env must be loaded before any entity import: column types are resolved
// inside entity decorators at import time (see checkIsPostgres)
const envPath = path.resolve(__dirname, '../../../../.env');
const dotenvResult = config({ path: envPath });
import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './modules/AppModule/app.module';
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';
import { getLogLevels } from './core/logging/get-log-levels';
import { getCorsOrigins, isSwaggerEnabled, shouldCompress } from './core/utils/http-hardening';
import {
  assertPublicApiConfig,
  getApiSurfaces,
  getPublicApiCacheMaxAge,
  getPublicApiRateLimit,
  PUBLIC_API_PREFIX,
} from './core/utils/public-api';
import {
  assertDatabaseDriverConsistent,
  assertRequiredConfig,
  checkIsPostgres,
  ConfigurationError,
  parseDatabaseUrl,
} from '../configuration';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  if (dotenvResult.error) {
    logger.warn(`Root .env not loaded from ${envPath} — relying on the process environment`);
  }
  try {
    assertRequiredConfig();
    assertPublicApiConfig();
    assertDatabaseDriverConsistent();
  } catch (error) {
    if (error instanceof ConfigurationError) {
      logger.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  const app = await NestFactory.create(AppModule, { logger: getLogLevels() });
  const httpServer = app.getHttpServer();
  // The batched dictionary import finishes in minutes and streams progress
  // continuously, so the long-request budget no longer needs 20-minute timeouts
  httpServer.requestTimeout = 5 * 60 * 1000;
  httpServer.headersTimeout = 5 * 60 * 1000 + 1000; // должен быть чуть больше keepAliveTimeout
  httpServer.keepAliveTimeout = 5 * 60 * 1000;

  // Swagger UI relies on an inline bootstrap script, so script-src additionally
  // allows inline scripts while it is served; production keeps the full defaults
  app.use(
    helmet(
      isSwaggerEnabled()
        ? {
            contentSecurityPolicy: {
              directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                'script-src': ["'self'", "'unsafe-inline'"],
              },
            },
          }
        : {},
    ),
  );
  app.use(compression({ filter: shouldCompress }));

  if (isSwaggerEnabled()) {
    const config = new DocumentBuilder()
      .setTitle('VocabBloom API')
      .setDescription('API documentation for VocabBloom backend')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup('api', app, document);
  }

  const corsOrigins = getCorsOrigins();
  app.enableCors({
    origin: corsOrigins,
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
  const { sqlitePath } = parseDatabaseUrl(process.env.DATABASE_URL);
  logger.log(`Server listening on port ${port}`);
  logger.log(
    `Database: ${
      isPostgres
        ? 'Postgres (DATABASE_URL), schema managed by migrations (migrationsRun on start)'
        : `better-sqlite3 (${sqlitePath ?? 'dev.sqlite fallback'}), synchronize=true`
    }`,
  );
  logger.log(`CORS origins: ${corsOrigins.join(', ')}`);
  logger.log(`Swagger UI: ${isSwaggerEnabled() ? 'enabled at /api' : 'disabled (production)'}`);
  const surfaces = getApiSurfaces();
  const rateLimit = getPublicApiRateLimit();
  logger.log(
    `Public API ${PUBLIC_API_PREFIX}: ${surfaces.publicApi ? `enabled, ${rateLimit.limit} requests per ${rateLimit.ttl / 1000} s per client, Cache-Control max-age=${getPublicApiCacheMaxAge()} s` : 'disabled (PUBLIC_API_ENABLED=false)'}; ` +
      `admin API: ${surfaces.adminApi ? 'enabled' : 'disabled (ADMIN_API_ENABLED=false)'}`,
  );
}
bootstrap();
