import { DictProtocol } from '../protocol';
import { DictReaderService } from '../dict-reader.service';
import { DICT_LIMITS } from '../config';
import { DictError } from '../wire';

const make = () => {
  const reader = {
    read: async <T>(fn: () => Promise<T>) => fn(),
    databases: jest.fn().mockResolvedValue([{ name: 'own', title: 'Custom "title"', own: true }]),
    info: jest.fn().mockResolvedValue('Terms\n.not a terminator'),
    matches: jest.fn().mockResolvedValue([{ database: 'own', word: 'hello "world"' }]),
    definitions: jest
      .fn()
      .mockResolvedValue([
        { word: 'hello', database: 'own', description: 'Custom', text: 'Meaning\n.\nAttribution' },
      ]),
  };
  return { reader, protocol: new DictProtocol(reader as unknown as DictReaderService) };
};
describe('DICT command responses', () => {
  it('returns framed definitions and matches, with MIME on every text response after negotiation', async () => {
    const { protocol, reader } = make();
    expect((await protocol.command('DEFINE own hello')).text).toBe(
      '150 1 definitions retrieved\r\n151 "hello" own "Custom"\r\nMeaning\r\n..\r\nAttribution\r\n.\r\n250 ok\r\n',
    );
    expect((await protocol.command('MATCH ! . hello')).text).toContain(
      '152 1 matches found\r\nown "hello \\"world\\""'.replace('\\\\', '\\'),
    );
    expect(reader.matches).toHaveBeenCalledWith('!', 'exact', 'hello');
    expect((await protocol.command('OPTION MIME')).text).toMatch(/^250/);
    for (const command of [
      'DEFINE * hello',
      'MATCH * exact hello',
      'SHOW DB',
      'SHOW STRATEGIES',
      'SHOW INFO own',
      'SHOW SERVER',
      'HELP',
    ]) {
      const response = (await protocol.command(command)).text;
      expect(response).toContain(
        'Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n',
      );
      expect(response).toMatch(/\r\n\.\r\n250 ok\r\n$/);
    }
    expect((await protocol.command('SHOW DATABASES')).text).toContain(
      'own "Custom \\"title\\""'.replace('\\\\', '\\'),
    );
    expect((await protocol.command('client original fixture')).text).toMatch(/^250/);
    expect((await protocol.command('STATUS')).text).toMatch(/^210/);
    expect(await protocol.command('QUIT')).toEqual({ text: '221 Closing connection\r\n', close: true });
  });
  it('distinguishes errors, missing results and unsupported capabilities', async () => {
    const { protocol, reader } = make();
    for (const [command, code] of [
      ['UNKNOWN', 500],
      ['MATCH own exact', 501],
      ['HELP extra', 501],
      ['SHOW', 501],
      ['SHOW WHAT', 503],
      ['OPTION X', 503],
      ['AUTH user token', 502],
      ['SASLAUTH x', 502],
    ])
      expect((await protocol.command(String(command))).text).toMatch(new RegExp(`^${code} `));
    reader.matches.mockResolvedValue([]);
    reader.definitions.mockResolvedValue([]);
    reader.databases.mockResolvedValue([]);
    expect((await protocol.command('MATCH * exact absent')).text).toMatch(/^552/);
    expect((await protocol.command('DEFINE * absent')).text).toMatch(/^552/);
    expect((await protocol.command('SHOW DB')).text).toMatch(/^554/);
    reader.info.mockRejectedValue(new DictError(550, 'Invalid database'));
    expect((await protocol.command('SHOW INFO unknown')).text).toMatch(/^550/);
    reader.info.mockResolvedValue('a'.repeat(DICT_LIMITS.responseBytes));
    expect((await protocol.command('SHOW INFO own')).text).toMatch(/^420/);
    reader.info.mockRejectedValue(new Error('database unavailable'));
    await expect(protocol.command('SHOW INFO own')).rejects.toThrow('database unavailable');
  });
});
