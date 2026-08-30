import { Writable } from 'node:stream';

/** Collects the lines a pino logger writes, so a test can read them back */
export const captureLines = () => {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      for (const line of String(chunk).split('\n')) if (line) lines.push(line);
      callback();
    },
  });
  const json = () => lines.map((line) => JSON.parse(line) as Record<string, any>);
  return { stream, lines, json };
};
