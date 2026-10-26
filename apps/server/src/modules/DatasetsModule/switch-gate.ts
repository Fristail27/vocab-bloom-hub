import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { requestPath } from '../../core/utils/public-api';

/** How long a switch waits for the requests under way before it goes ahead without them */
export const SWITCH_DRAIN_TIMEOUT_MS = 5000;

type RequestStateT = () => {
  method: string;
  path: string;
  ageMs: number;
  destroyed: boolean;
  writableFinished: boolean;
};

/**
 * Keeps requests and a switch of the active dataset apart (issue #527).
 * A switch closes the database connection and opens it on another schema: a
 * request in between would find no connection. So a switch waits for the
 * requests under way to finish, and the requests that arrive meanwhile wait
 * for the switch — a few tens of milliseconds.
 */
export class SwitchGate {
  private inFlight = 0;
  private held: Promise<void> | null = null;
  private onIdle: (() => void) | null = null;
  private readonly logger = new Logger(SwitchGate.name);
  private readonly requests = new Set<RequestStateT>();

  /** Requests being handled right now */
  get busy(): number {
    return this.inFlight;
  }

  /** A request comes in: after the switch under way, when there is one */
  async enter(request?: RequestStateT): Promise<void> {
    // another switch may have begun while this one was awaited
    while (this.held) await this.held;
    this.inFlight += 1;
    if (request) this.requests.add(request);
  }

  leave(request?: RequestStateT): void {
    if (request) this.requests.delete(request);
    this.inFlight = Math.max(0, this.inFlight - 1);
    if (this.inFlight === 0) this.onIdle?.();
  }

  /**
   * Runs `work` with no request under way and none let in. Answers how many
   * requests were still running when the patience ran out — they meet the
   * switch the hard way.
   */
  async hold<T>(
    work: () => Promise<T>,
    timeoutMs: number = SWITCH_DRAIN_TIMEOUT_MS,
  ): Promise<{ result: T; abandoned: number }> {
    let release!: () => void;
    this.held = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      const abandoned = await this.drained(timeoutMs);
      return { result: await work(), abandoned };
    } finally {
      this.held = null;
      release();
    }
  }

  private drained(timeoutMs: number): Promise<number> {
    if (this.inFlight === 0) return Promise.resolve(0);
    return new Promise<number>((resolve) => {
      const done = (): void => {
        clearTimeout(timer);
        this.onIdle = null;
        resolve(this.inFlight);
      };
      const timer = setTimeout(() => {
        this.logger.warn({
          message: 'Timed out waiting for dataset requests to finish',
          busy: this.inFlight,
          requests: [...this.requests].map((read) => read()),
        });
        done();
      }, timeoutMs);
      timer.unref();
      this.onIdle = done;
    });
  }
}

// the request that asks for the switch cannot wait for it, nor be waited for
const ACTIVATE_ROUTE = /^\/api\/en\/datasets\/[^/]+\/activate\/?$/;
const RECONCILIATION_APPLY_ROUTE = /^\/api\/en\/datasets\/[^/]+\/reconciliation\/[^/]+\/apply(?:\/start)?\/?$/;
// This read only inspects in-memory progress, so publication must not block it.
const RECONCILIATION_PROGRESS_ROUTE = /^\/api\/en\/datasets\/[^/]+\/reconciliation\/application\/?$/;

/** Counts every request in and out of the gate; runs before routing */
export const switchGateMiddleware =
  (gate: SwitchGate) =>
  (req: Request, res: Response, next: NextFunction): void => {
    // An earlier middleware may finish after the connection has already closed.
    // Its finish/close event will not fire again for listeners registered here.
    if (res.destroyed || res.writableFinished) return;
    if (
      ACTIVATE_ROUTE.test(requestPath(req)) ||
      (req.method === 'GET' && RECONCILIATION_PROGRESS_ROUTE.test(requestPath(req))) ||
      (req.method === 'POST' && RECONCILIATION_APPLY_ROUTE.test(requestPath(req)))
    )
      return next();
    let entered = false;
    let closed = false;
    const startedAt = Date.now();
    // Only method/path and response state, never credentials, query strings or bodies.
    const request = () => ({
      method: req.method,
      path: requestPath(req),
      ageMs: Date.now() - startedAt,
      destroyed: res.destroyed,
      writableFinished: res.writableFinished,
    });
    // a client that gave up while waiting never entered and must not leave
    const finished = () => {
      if (closed) return;
      closed = true;
      if (entered) gate.leave(request);
    };
    res.once('finish', finished);
    res.once('close', finished);
    void gate.enter(request).then(() => {
      if (closed) return gate.leave(request);
      entered = true;
      next();
    });
  };
