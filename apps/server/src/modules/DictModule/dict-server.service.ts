import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { createServer, Server, Socket } from 'node:net';
import { DictConfig, DICT_LIMITS, getDictConfig } from './config';
import { DictReaderService } from './dict-reader.service';
import { DictProtocol } from './protocol';
import { DictSession } from './session';
import { status } from './wire';

@Injectable()
export class DictServerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(DictServerService.name);
  private server: Server | undefined;
  private stopping = false;
  private readonly sessions = new Map<Socket, { session: DictSession; ip: string }>();
  private readonly work = new Set<DictSession>();
  private readonly rates = new Map<string, { count: number; until: number }>();
  private cleanup: NodeJS.Timeout | undefined;
  constructor(private readonly reader: DictReaderService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.start(getDictConfig());
  }
  get address(): ReturnType<Server['address']> {
    return this.server?.address() ?? null;
  }
  async start(config: DictConfig): Promise<void> {
    if (!config.enabled || this.server) return;
    this.stopping = false;
    const server = createServer({ allowHalfOpen: true }, (socket) => {
      const ip = socket.remoteAddress ?? 'unknown';
      const perIp = [...this.sessions.values()].filter((value) => value.ip === ip).length;
      if (
        this.stopping ||
        this.sessions.size >= config.maxConnections ||
        perIp >= DICT_LIMITS.connectionsPerIp
      ) {
        socket.on('error', () => undefined);
        socket.end(
          this.stopping ? status(421, 'Server shutting down') : status(420, 'Connection limit exceeded'),
        );
        socket.setTimeout(1000, () => socket.destroy());
        return;
      }
      const consume = (): boolean => {
        const now = Date.now();
        let rate = this.rates.get(ip);
        if (!rate || rate.until <= now) {
          if (!rate && this.rates.size >= DICT_LIMITS.rateBuckets) return false;
          rate = { count: 0, until: now + DICT_LIMITS.rateWindowMs };
          this.rates.set(ip, rate);
        }
        return ++rate.count <= config.rateLimit;
      };
      const session = new DictSession(socket, new DictProtocol(this.reader), consume, config.idleMs, (error) =>
        this.logger.error(error instanceof Error ? error.message : String(error)),
      );
      this.sessions.set(socket, { session, ip });
      this.work.add(session);
      socket.once('close', () => {
        this.sessions.delete(socket);
        void session.drained.then(() => this.work.delete(session));
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.port, config.host, () => {
        server.off('error', reject);
        resolve();
      });
    });
    server.on('error', (error) => this.logger.error(error.message));
    this.server = server;
    this.cleanup = setInterval(() => {
      for (const [ip, rate] of this.rates) if (rate.until <= Date.now()) this.rates.delete(ip);
    }, DICT_LIMITS.rateWindowMs);
    this.cleanup.unref();
    this.logger.log(
      `DICT listening on ${config.host}:${typeof this.address === 'object' ? this.address?.port : config.port}`,
    );
  }

  /** This module stops before its imported dataset/TypeORM modules close their connections. */
  async onModuleDestroy(): Promise<void> {
    const server = this.server;
    if (!server) return;
    this.stopping = true;
    this.server = undefined;
    clearInterval(this.cleanup);
    const closed = new Promise<void>((resolve) => server.close(() => resolve()));
    const sessions = [...this.sessions];
    for (const [, { session }] of sessions) session.stop(421, 'Server shutting down');
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, DICT_LIMITS.shutdownMs);
    });
    await Promise.race([Promise.all([...this.work].map((session) => session.drained)), deadline]);
    clearTimeout(timer);
    for (const [socket] of sessions) socket.destroy();
    await closed;
    this.rates.clear();
  }
}
