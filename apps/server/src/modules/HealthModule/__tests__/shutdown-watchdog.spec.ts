import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { ShutdownWatchdog } from '../shutdown-watchdog';

class TestWatchdog extends ShutdownWatchdog {
  exits: number[] = [];

  protected override exit(code: number): void {
    this.exits.push(code);
  }
}

describe('ShutdownWatchdog (issue #315)', () => {
  const saved = process.env.SHUTDOWN_TIMEOUT;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    if (saved === undefined) delete process.env.SHUTDOWN_TIMEOUT;
    else process.env.SHUTDOWN_TIMEOUT = saved;
  });

  it('does nothing when the shutdown completes within the budget', () => {
    process.env.SHUTDOWN_TIMEOUT = '2';
    const watchdog = new TestWatchdog();
    watchdog.onModuleDestroy();
    jest.advanceTimersByTime(1_500);
    watchdog.onApplicationShutdown('SIGTERM');
    jest.advanceTimersByTime(10_000);
    expect(watchdog.exits).toEqual([]);
  });

  it('forces exit code 1 when the shutdown exceeds SHUTDOWN_TIMEOUT', () => {
    process.env.SHUTDOWN_TIMEOUT = '2';
    const watchdog = new TestWatchdog();
    watchdog.onModuleDestroy();
    jest.advanceTimersByTime(1_999);
    expect(watchdog.exits).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(watchdog.exits).toEqual([1]);
  });

  it('arms one timer per shutdown and ignores a shutdown hook without a pending timer', () => {
    process.env.SHUTDOWN_TIMEOUT = '1';
    const watchdog = new TestWatchdog();
    watchdog.onApplicationShutdown();
    watchdog.onModuleDestroy();
    watchdog.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(1_000);
    expect(watchdog.exits).toEqual([1]);
  });
});
