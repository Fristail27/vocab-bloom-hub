import { DICT_LIMITS } from './config';

export class DictError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
  }
}
export const syntax = (): never => {
  throw new DictError(501, 'Illegal parameters');
};

/** RFC words can concatenate atoms, either quoted string, and escaped characters. */
export function parseCommand(line: string): string[] {
  // RFC lexical tokens exclude ASCII controls; tab is the argument separator.
  // eslint-disable-next-line no-control-regex
  if (Array.from(line).length + 2 > DICT_LIMITS.commandCharacters || /[\x00-\x08\x0a-\x1f\x7f]/.test(line))
    syntax();
  const words: string[] = [];
  let word = '',
    quote = '',
    started = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '\\') {
      if (++i === line.length) syntax();
      word += line[i];
      started = true;
    } else if (quote) {
      if (char === quote) quote = '';
      else word += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (char === ' ' || char === '\t') {
      if (started) {
        words.push(word);
        word = '';
        started = false;
      }
    } else {
      word += char;
      started = true;
    }
  }
  if (quote) syntax();
  if (started) words.push(word);
  if (!words.length) syntax();
  // The command name is an atom, not a quoted/escaped word.
  if (!/^[^\s'"\\]+(?:[ \t]|$)/.test(line)) syntax();
  return words;
}
// Strip terminal controls at the plain-text protocol boundary while preserving line breaks.
// eslint-disable-next-line no-control-regex
const clean = (value: string): string => value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '\ufffd');
export const quote = (value: string): string =>
  `"${clean(value)
    .replace(/[\r\n\t]/g, ' ')
    .replace(/["\\]/g, '\\$&')}"`;
export const status = (code: number, text: string): string => {
  const line = `${code} ${text}`;
  if (/[\r\n]/.test(line) || Array.from(line).length > 1022) throw new DictError(420, 'Response line too long');
  return `${line}\r\n`;
};

/** Never split UTF-8 characters; account for dot-stuffing and CRLF in the RFC line limit. */
export function textBlock(text: string, mime: boolean, structured = false): string {
  if (Buffer.byteLength(text) > DICT_LIMITS.responseBytes) throw new DictError(420, 'Response too large');
  const lines: string[] = [];
  if (mime) lines.push('Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '');
  for (const line of clean(text).replace(/\r\n?/g, '\n').split('\n')) {
    const chars = Array.from(line);
    if (structured && chars.length + (line.startsWith('.') ? 1 : 0) > 1022)
      throw new DictError(420, 'Response line too long');
    if (!chars.length) {
      lines.push('');
      continue;
    }
    for (let start = 0; start < chars.length;) {
      const dot = chars[start] === '.';
      const part = chars.slice(start, start + (dot ? 1021 : 1022));
      lines.push((dot ? '.' : '') + part.join(''));
      start += part.length;
    }
  }
  return `${lines.join('\r\n')}\r\n.\r\n`;
}
