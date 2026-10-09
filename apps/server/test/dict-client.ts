import { createConnection, Socket } from 'node:net';

/** A deliberately independent line-oriented DICT test client. */
export class DictClient {
  private buffer = '';
  private lines: string[] = [];
  private waiting: (() => void) | undefined;
  closed = false;
  readonly socket: Socket;
  constructor(port: number) {
    this.socket = createConnection({ host: '127.0.0.1', port });
    this.socket.setEncoding('utf8');
    this.socket.on('data', (chunk: string) => {
      this.buffer += chunk;
      let index: number;
      while ((index = this.buffer.indexOf('\r\n')) >= 0) {
        this.lines.push(this.buffer.slice(0, index));
        this.buffer = this.buffer.slice(index + 2);
      }
      this.waiting?.();
    });
    this.socket.on('error', () => undefined);
    this.socket.on('close', () => {
      this.closed = true;
      this.waiting?.();
    });
  }
  async line(): Promise<string> {
    if (this.lines.length) return this.lines.shift()!;
    if (this.closed) throw new Error('DICT connection closed');
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.waiting = undefined;
        reject(new Error('DICT response timed out'));
      }, 3000);
      this.waiting = () => {
        clearTimeout(timeout);
        this.waiting = undefined;
        resolve();
      };
    });
    return this.line();
  }
  async response(): Promise<string> {
    const lines: string[] = [];
    let block = false;
    while (true) {
      const line = await this.line();
      lines.push(line);
      if (block) {
        if (line === '.') block = false;
        continue;
      }
      if (/^1(?:10|11|12|13|14|51|52) /.test(line)) block = true;
      else if (/^[245]\d\d(?: |$)/.test(line)) return lines.join('\r\n') + '\r\n';
    }
  }
  command(command: string): Promise<string> {
    this.socket.write(command + '\r\n');
    return this.response();
  }
  destroy(): void {
    this.socket.destroy();
  }
}
