import type { Socket } from 'node:net';
import { randomUUID } from 'node:crypto';
import { getVersion } from '../../../configuration';
import { DICT_LIMITS } from './config';
import { DictProtocol } from './protocol';
import { status } from './wire';

export class DictSession {
  private buffer = Buffer.alloc(0);
  private readonly queue: string[] = [];
  private running = false;
  private ended = false;
  private terminal: string | undefined;
  private drainQueue = false;
  private work: Promise<void> = Promise.resolve();

  constructor(
    private readonly socket: Socket,
    private readonly protocol: DictProtocol,
    private readonly consume: () => boolean,
    idleMs: number,
    private readonly reportError: (error: unknown) => void,
  ) {
    socket.setNoDelay(true);
    socket.setTimeout(idleMs);
    socket.on('error', () => undefined); // disconnects are expected, never unhandled events
    socket.on('timeout', () => {
      if (this.running) socket.destroy();
      else this.stop(420, 'Idle timeout');
    });
    socket.on('data', (data: Buffer) => this.receive(data));
    socket.on('end', () => {
      this.ended = true;
      if (this.buffer.length) this.stop(501, 'Incomplete command', true);
      else this.pump();
    });
    socket.write(status(220, `Vocab Bloom Hub ${getVersion()} <mime> <${randomUUID()}@localhost>`));
  }

  get drained(): Promise<void> {
    return this.work;
  }
  stop(code: number, message: string, drainQueue = false): void {
    this.terminal = status(code, message);
    this.drainQueue = drainQueue;
    if (!drainQueue) this.queue.length = 0;
    this.buffer = Buffer.alloc(0);
    this.pump();
  }
  private receive(data: Buffer): void {
    if (this.terminal || this.socket.destroyed || this.socket.writableEnded) return;
    this.buffer = Buffer.concat([this.buffer, data]);
    while (true) {
      const end = this.buffer.indexOf(10);
      if (end < 0) break;
      if (end + 1 > DICT_LIMITS.commandBytes || this.queue.length >= DICT_LIMITS.queuedCommands) {
        this.stop(420, 'Input limit exceeded');
        return;
      }
      const line = this.buffer.subarray(0, end + 1);
      this.buffer = this.buffer.subarray(end + 1);
      try {
        if (line.length < 2 || line[line.length - 2] !== 13) throw new Error('CRLF required');
        this.queue.push(new TextDecoder('utf-8', { fatal: true }).decode(line.subarray(0, -2)));
      } catch {
        this.stop(501, 'Invalid UTF-8 or CRLF framing', true);
        return;
      }
    }
    if (this.buffer.length > DICT_LIMITS.commandBytes) {
      this.stop(420, 'Command too long');
      return;
    }
    this.pump();
  }
  private async write(text: string): Promise<void> {
    if (this.socket.destroyed || this.socket.writableEnded) return;
    await new Promise<void>((resolve) => {
      const done = (): void => {
        this.socket.off('close', done);
        resolve();
      };
      this.socket.once('close', done);
      this.socket.write(text, done); // one response at a time, waiting for backpressure
    });
  }
  private pump(): void {
    if (this.running || this.socket.destroyed || this.socket.writableEnded) return;
    this.running = true;
    this.work = (async () => {
      try {
        while (!this.socket.destroyed && this.queue.length && (!this.terminal || this.drainQueue)) {
          if (!this.consume()) {
            this.terminal = status(420, 'Command rate limit exceeded');
            break;
          }
          const response = await this.protocol.command(this.queue.shift()!);
          if (this.socket.destroyed) break;
          await this.write(response.text);
          if (response.close) {
            this.socket.end();
            return;
          }
        }
        if (this.terminal && !this.socket.destroyed) {
          await this.write(this.terminal);
          this.socket.end();
        } else if (this.ended && !this.queue.length) this.socket.end();
      } catch (error) {
        this.reportError(error);
        await this.write(status(420, 'Server temporarily unavailable'));
        this.socket.end();
      } finally {
        this.running = false;
      }
    })();
  }
}
