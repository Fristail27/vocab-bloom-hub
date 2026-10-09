import { getDictConfig } from '../config';
import { DictError, parseCommand, quote, textBlock } from '../wire';

describe('DICT wire grammar and bounds', () => {
  it('parses quotes, concatenation, escapes and Unicode without shell interpretation', () => {
    expect(parseCommand(String.raw`MATCH * prefix "naïve \"phrase\""`)).toEqual([
      'MATCH',
      '*',
      'prefix',
      'naïve "phrase"',
    ]);
    expect(parseCommand(String.raw`DEFINE default 'take '\flight`)).toEqual([
      'DEFINE',
      'default',
      'take flight',
    ]);
    expect(parseCommand('DEFINE\tdefault ""')).toEqual(['DEFINE', 'default', '']);
    for (const invalid of ['"HELP"', '', 'DEFINE x "open', 'HELP\\', 'HELP\0', 'x'.repeat(1023)])
      expect(() => parseCommand(invalid)).toThrow(DictError);
  });
  it('wraps by Unicode characters, preserves content and escapes terminators including wrapped dots', () => {
    const source = '.' + '😀'.repeat(1020) + '.tail\n.\nlast';
    const encoded = textBlock(source, false);
    expect(encoded).toContain('\r\n..tail\r\n..\r\n');
    const lines = encoded.split('\r\n').slice(0, -2);
    expect(lines.every((line) => Array.from(line).length + 2 <= 1024)).toBe(true);
    expect(lines.map((line) => (line.startsWith('..') ? line.slice(1) : line)).join('')).toBe(
      source.replaceAll('\n', ''),
    );
    expect(textBlock('.', true)).toBe(
      'Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n..\r\n.\r\n',
    );
    expect(() => textBlock('x'.repeat(1023), false, true)).toThrow(DictError);
    expect(quote('a"b\\c\r\ninjected')).toBe('"a\\"b\\\\c  injected"');
  });
  it('is opt-in and rejects malformed or unbounded configuration', () => {
    expect(getDictConfig({})).toMatchObject({ enabled: false, host: '127.0.0.1', port: 2628, rateLimit: 100 });
    expect(getDictConfig({ DICT_ENABLED: 'true', DICT_PORT: '52628' }).enabled).toBe(true);
    for (const env of [
      { DICT_ENABLED: 'yes' },
      { DICT_PORT: '0' },
      { DICT_PORT: '65536' },
      { DICT_IDLE_TIMEOUT: 'NaN' },
      { DICT_MAX_CONNECTIONS: '-1' },
      { DICT_RATE_LIMIT: '1.5' },
    ])
      expect(() => getDictConfig(env)).toThrow();
  });
});
