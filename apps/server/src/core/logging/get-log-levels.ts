import { LogLevel } from '@nestjs/common';

const LOG_LEVEL_HIERARCHY: LogLevel[] = ['verbose', 'debug', 'log', 'warn', 'error', 'fatal'];

/**
 * Возвращает набор уровней логирования для NestJS исходя из env LOG_LEVEL.
 * По умолчанию: debug в development, log в остальных окружениях.
 */
export const getLogLevels = (): LogLevel[] => {
  const fallback: LogLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'log';
  const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
  const level = envLevel && LOG_LEVEL_HIERARCHY.includes(envLevel) ? envLevel : fallback;

  return LOG_LEVEL_HIERARCHY.slice(LOG_LEVEL_HIERARCHY.indexOf(level));
};
