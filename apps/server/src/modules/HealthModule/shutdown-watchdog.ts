import { Injectable, Logger, OnApplicationShutdown, OnModuleDestroy } from '@nestjs/common';
import { getShutdownTimeout } from '../../core/utils/shutdown';

/**
 * Bounds a graceful stop (issue #315). Nest runs `onModuleDestroy` first
 * when the application closes (SIGTERM / SIGINT through
 * `enableShutdownHooks`, or `app.close()`), then closes the HTTP server
 * — waiting for the requests in flight — and calls `onApplicationShutdown`
 * last. The timer armed by the first hook and cleared by the last one
 * turns a stop that exceeds SHUTDOWN_TIMEOUT into a logged, deliberate
 * exit instead of a silent SIGKILL from the process manager.
 */
@Injectable()
export class ShutdownWatchdog implements OnModuleDestroy, OnApplicationShutdown {
  private readonly logger = new Logger(ShutdownWatchdog.name);
  private timer: NodeJS.Timeout | undefined;

  /** Overridden by the tests; the real thing ends the process */
  protected exit(code: number): void {
    process.exit(code);
  }

  onModuleDestroy(): void {
    if (this.timer) return;
    const seconds = getShutdownTimeout();
    this.logger.log(`Shutting down: no new connections; waiting up to ${seconds} s for requests in flight`);
    this.timer = setTimeout(() => {
      this.logger.error(`Shutdown did not finish within ${seconds} s (SHUTDOWN_TIMEOUT) — forcing exit`);
      this.exit(1);
    }, seconds * 1000);
    // the timer must not keep an otherwise finished process alive
    this.timer.unref();
  }

  onApplicationShutdown(signal?: string): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.logger.log(`Shutdown complete${signal ? ` (${signal})` : ''}`);
  }
}
