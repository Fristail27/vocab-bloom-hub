import { config } from 'dotenv';
import path from 'path';
import { resolveEnvFile } from '../configuration';
// The env must be loaded before any entity import: column types are resolved
// inside entity decorators at import time (see checkIsPostgres). ENV_FILE
// names the file explicitly (a build deployed outside the repository tree);
// the default is the repository root, resolved from dist/src
const envFile = resolveEnvFile(path.resolve(__dirname, '../../../../.env'));
const dotenvResult = config({ path: envFile.path });
import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './modules/AppModule/app.module';
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';
import { buildAdminDocument } from './openapi/build-openapi';
import { PublicOpenApiService } from './modules/PublicApiModule/public-openapi.service';
import { getLogLevels } from './core/logging/get-log-levels';
import { getCorsOrigins, getTrustProxy, isSwaggerEnabled, shouldCompress } from './core/utils/http-hardening';
import { getMetricsPath, isMetricsEnabled } from './modules/MetricsModule/metrics.config';
import { HEALTH_PATH, READY_PATH } from './modules/HealthModule/health.controller';
import { getShutdownTimeout } from './core/utils/shutdown';
import { isAutoImportEnabled } from './modules/EnModule/modules/EnImportDictionary/dictionaryBootstrap.service';
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

  if (dotenvResult.error && envFile.explicit) {
    // an explicitly named file that is missing is a deployment mistake, not a
    // "variables come from the environment" setup: fail before hashing
    // whatever the environment happens to hold
    logger.error(`ENV_FILE=${envFile.path} could not be read: ${dotenvResult.error.message}`);
    process.exit(1);
  }
  if (dotenvResult.error) {
    logger.warn(`Root .env not loaded from ${envFile.path} — relying on the process environment`);
  } else {
    logger.log(`Environment loaded from ${envFile.path}${envFile.explicit ? ' (ENV_FILE)' : ''}`);
  }
  try {
    assertRequiredConfig();
    assertPublicApiConfig();
    assertDatabaseDriverConsistent();
    getShutdownTimeout();
  } catch (error) {
    if (error instanceof ConfigurationError) {
      logger.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  const app = await NestFactory.create(AppModule, { logger: getLogLevels() });
  // Behind a reverse proxy the client address comes from X-Forwarded-For;
  // TRUST_PROXY says which hops may set it (docs/deployment/reverse-proxy.md)
  const trustProxy = getTrustProxy();
  app.getHttpAdapter().getInstance().set('trust proxy', trustProxy);
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
    SwaggerModule.setup('api', app, buildAdminDocument(app));
  }
  // GET /api/v1/openapi.json answers in every environment, Swagger UI or not
  app.get(PublicOpenApiService).attach(app);

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
  // SIGTERM / SIGINT (process manager, container stop) close the app in
  // order: readiness turns 503, the listener closes, requests in flight
  // finish, the database pool closes; ShutdownWatchdog bounds the wait
  app.enableShutdownHooks();

  const port = process.env.SERVER_PORT || 3010;
  await app.listen(port);

  const isPostgres = checkIsPostgres();
  const { sqlitePath } = parseDatabaseUrl(process.env.DATABASE_URL);
  logger.log(`Server listening on port ${port}`);
  logger.log(
    `Probes: liveness at ${HEALTH_PATH}, readiness at ${READY_PATH}; graceful shutdown on SIGTERM, up to ${getShutdownTimeout()} s (SHUTDOWN_TIMEOUT)`,
  );
  logger.log(
    isAutoImportEnabled()
      ? 'Dictionary auto-import: enabled — an empty dictionary is loaded on first start (DICTIONARY_AUTO_IMPORT)'
      : 'Dictionary auto-import: disabled (DICTIONARY_AUTO_IMPORT) — load the dictionary from the admin UI',
  );
  logger.log(
    `Database: ${
      isPostgres
        ? 'Postgres (DATABASE_URL), schema managed by migrations (migrationsRun on start)'
        : `better-sqlite3 (${sqlitePath ?? 'dev.sqlite fallback'}), synchronize=true`
    }`,
  );
  logger.log(`CORS origins: ${corsOrigins.join(', ')}`);
  logger.log(
    trustProxy === false
      ? 'Trust proxy: off — X-Forwarded-* headers are ignored (set TRUST_PROXY behind a reverse proxy)'
      : `Trust proxy: ${String(trustProxy)} — client addresses are read from X-Forwarded-For`,
  );
  logger.log(
    `Swagger UI: ${isSwaggerEnabled() ? 'enabled at /api' : 'disabled (production)'}; public OpenAPI document at ${PUBLIC_API_PREFIX}/openapi.json`,
  );
  logger.log(
    isMetricsEnabled()
      ? `Prometheus metrics: enabled at ${getMetricsPath()} — keep it off the public internet (docs/observability.md)`
      : 'Prometheus metrics: disabled (METRICS_ENABLED=false)',
  );
  const surfaces = getApiSurfaces();
  const rateLimit = getPublicApiRateLimit();
  logger.log(
    `Public API ${PUBLIC_API_PREFIX}: ${surfaces.publicApi ? `enabled, ${rateLimit.limit} requests per ${rateLimit.ttl / 1000} s per client, Cache-Control max-age=${getPublicApiCacheMaxAge()} s` : 'disabled (PUBLIC_API_ENABLED=false)'}; ` +
      `admin API: ${surfaces.adminApi ? 'enabled' : 'disabled (ADMIN_API_ENABLED=false)'}`,
  );
}
bootstrap();
