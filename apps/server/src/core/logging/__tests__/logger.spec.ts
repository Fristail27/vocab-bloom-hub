import { Logger } from '@nestjs/common';
import { captureLines } from '../../../../test/harness/log-capture';

// nestjs-pino v5 keeps the root logger in module-level singletons and hides its
// test-only reset behind the package exports map, so reloading the module graph
// before every test is the reset now: each test gets a fresh logger bound to
// its own capture stream
type LoggerModuleT = typeof import('../logger');
const loadLogger = (): LoggerModuleT => {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../logger') as LoggerModuleT;
};

describe('createLoggerParams / createNestLogger (issue #280)', () => {
  it('writes one JSON object per line with a string level, an ISO time, the context and the message', () => {
    const { createLoggerParams, createNestLogger } = loadLogger();
    const { stream, lines } = captureLines();
    const logger = createNestLogger(createLoggerParams({ format: 'json', level: 'info', stream }));

    logger.log('Server listening on port 3010', 'Bootstrap');
    logger.warn('careful', 'SomeService');
    logger.debug?.('hidden below the level', 'SomeService');

    expect(lines).toHaveLength(2);
    const [first, second] = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(first).toMatchObject({ level: 'info', context: 'Bootstrap', msg: 'Server listening on port 3010' });
    expect(typeof first.time).toBe('string');
    expect(Date.parse(first.time as string)).not.toBeNaN();
    expect(second).toMatchObject({ level: 'warn', context: 'SomeService', msg: 'careful' });
  });

  it("keeps Nest's error(message, stack) contract: the stack lands in err.stack", () => {
    const { createLoggerParams, createNestLogger } = loadLogger();
    const { stream, lines } = captureLines();
    const logger = createNestLogger(createLoggerParams({ format: 'json', level: 'info', stream }));
    const error = new Error('boom');

    logger.error('Import failed', error.stack, 'Import');
    logger.error({ err: error, statusCode: 500 }, 'with an error object', 'Filter');

    const [byContract, byObject] = lines.map((line) => JSON.parse(line) as Record<string, any>);
    expect(byContract.level).toBe('error');
    expect(byContract.context).toBe('Import');
    expect(byContract.err.stack).toContain('Error: boom');
    expect(byObject).toMatchObject({
      level: 'error',
      context: 'Filter',
      statusCode: 500,
      msg: 'with an error object',
    });
    expect(byObject.err).toMatchObject({ type: 'Error', message: 'boom' });
    expect(byObject.err.stack).toContain('Error: boom');
  });

  it("serves Nest's static Logger once installed with overrideLogger (the bootstrap lines)", () => {
    const { createLoggerParams, createNestLogger } = loadLogger();
    const { stream, lines } = captureLines();
    Logger.overrideLogger(createNestLogger(createLoggerParams({ format: 'json', level: 'info', stream })));
    try {
      new Logger('Bootstrap').log('Environment loaded');
    } finally {
      Logger.overrideLogger(true);
    }
    expect(JSON.parse(lines[0])).toMatchObject({
      level: 'info',
      context: 'Bootstrap',
      msg: 'Environment loaded',
    });
  });

  it('redacts credentials from a request object logged by hand', () => {
    const { createLoggerParams, createNestLogger } = loadLogger();
    const { stream, lines } = captureLines();
    const logger = createNestLogger(createLoggerParams({ format: 'json', level: 'info', stream }));

    logger.log(
      { req: { headers: { authorization: 'Bearer secret-token', cookie: 'bearer=secret-cookie' } } },
      'x',
    );

    // nestjs-pino v5 routes even out-of-context logs through the request
    // serializer: a hand-made req object serializes to an empty one, and a
    // real request's headers are censored by the redact paths — either way
    // the credentials cannot reach the line
    expect(lines[0]).not.toContain('secret-token');
    expect(lines[0]).not.toContain('secret-cookie');
    expect(JSON.parse(lines[0]).req).toEqual({});
  });
});
