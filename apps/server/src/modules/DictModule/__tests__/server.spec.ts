import type { AddressInfo } from 'node:net';
import { DictClient } from '../../../../test/dict-client';
import { DictReaderService } from '../dict-reader.service';
import { DictServerService } from '../dict-server.service';
import { getDictConfig, DictConfig } from '../config';
import { DatasetsService } from '../../DatasetsModule/datasets.service';
import { PublicMetaService } from '../../PublicApiModule/public-meta.service';
import { SwitchGate } from '../../DatasetsModule/switch-gate';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
describe('DICT TCP resource limits and lifecycle', () => {
  let server: DictServerService;
  const clients: DictClient[] = [];
  let port: number;
  const reader = { read: async <T>(fn: () => Promise<T>) => fn(), info: jest.fn() };
  const start = async (options: Partial<DictConfig> = {}) => {
    server = new DictServerService(reader as unknown as DictReaderService);
    await server.start({ ...getDictConfig({}), enabled: true, port: 0, ...options });
    port = (server.address as AddressInfo).port;
  };
  const connect = async (code = 220) => {
    const client = new DictClient(port);
    clients.push(client);
    expect(await client.line()).toMatch(new RegExp(`^${code} `));
    return client;
  };
  afterEach(async () => {
    clients.splice(0).forEach((client) => client.destroy());
    await server?.onModuleDestroy();
    reader.info.mockReset();
  });
  it('bounds concurrent connections and closes idle clients', async () => {
    await start({ maxConnections: 1, idleMs: 100 });
    const client = await connect();
    await connect(420);
    expect(await client.response()).toMatch(/^420 Idle timeout/);
  });
  it('shares command rate limits by peer address, including reconnects', async () => {
    await start({ rateLimit: 2 });
    const first = await connect();
    expect(await first.command('STATUS')).toMatch(/^210/);
    expect(await first.command('STATUS')).toMatch(/^210/);
    const second = await connect();
    expect(await second.command('STATUS')).toMatch(/^420 Command rate limit/);
  });
  it('rejects a flooded pipeline and drains valid commands after client half-close', async () => {
    await start();
    const flood = await connect();
    flood.socket.write('STATUS\r\n'.repeat(34));
    expect(await flood.response()).toMatch(/^420 Input limit/);
    const client = await connect();
    client.socket.end('STATUS\r\nQUIT\r\n');
    expect(await client.response()).toMatch(/^210/);
    expect(await client.response()).toMatch(/^221/);
    const malformed = await connect();
    malformed.socket.write('STATUS\r\nHELP\n');
    expect(await malformed.response()).toMatch(/^210/);
    expect(await malformed.response()).toMatch(/^501/);
  });
  it('reports a read failure without exposing database errors and remains available', async () => {
    await start();
    reader.info.mockRejectedValue(new Error('private connection details'));
    const client = await connect();
    expect(await client.command('SHOW INFO own')).toBe('420 Server temporarily unavailable\r\n');
    const other = await connect();
    expect(await other.command('STATUS')).toMatch(/^210/);
  });
  it('waits for an in-flight read before shutdown and preserves response boundaries', async () => {
    await start();
    const entered = deferred(),
      release = deferred();
    reader.info.mockImplementation(async () => {
      entered.resolve();
      await release.promise;
      return 'terms';
    });
    const client = await connect();
    const response = client.command('SHOW INFO own');
    await entered.promise;
    let finished = false;
    const closing = server.onModuleDestroy().then(() => {
      finished = true;
    });
    await Promise.resolve();
    expect(finished).toBe(false);
    release.resolve();
    expect(await response).toBe('112 Database information follows\r\nterms\r\n.\r\n250 ok\r\n');
    expect(await client.response()).toMatch(/^421/);
    await closing;
    expect(server.address).toBeNull();
  });
  it('does not let dataset switching close a reader during its command, and releases after errors', async () => {
    const gate = new SwitchGate();
    const service = new DictReaderService({ gate } as DatasetsService, {} as PublicMetaService);
    const entered = deferred(),
      release = deferred();
    const reading = service.read(async () => {
      entered.resolve();
      await release.promise;
      throw new Error('read failed');
    });
    const caught = reading.catch((error: Error) => error.message);
    await entered.promise;
    expect(gate.busy).toBe(1);
    const switched = jest.fn();
    const switching = gate.hold(async () => {
      switched();
    });
    await Promise.resolve();
    expect(switched).not.toHaveBeenCalled();
    release.resolve();
    expect(await caught).toBe('read failed');
    await switching;
    expect(switched).toHaveBeenCalledTimes(1);
    expect(gate.busy).toBe(0);
  });
});
