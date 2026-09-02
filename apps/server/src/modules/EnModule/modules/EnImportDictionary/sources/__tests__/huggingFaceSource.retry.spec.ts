import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InternalServerErrorException, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { ImportDictionaryChunkT } from '../../../../../../../types';
import type { ImportProgressSink } from '../../progress';
import { fetchDatasetRevisions, HuggingFaceDatasetSource } from '../huggingFaceSource';

const textResponse = (body: string, status = 200): Response =>
  new Response(body, { status, headers: { 'content-length': String(Buffer.byteLength(body)) } });

/** A body whose first chunk arrives and whose second never comes */
const stallingResponse = (): Response =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"word":"a"}\n'));
        // never closes, never enqueues again
      },
    }),
    { status: 200 },
  );

const sink = (): ImportProgressSink & { chunks: ImportDictionaryChunkT[] } => {
  const chunks: ImportDictionaryChunkT[] = [];
  return { chunks, start: () => {}, write: (c) => chunks.push(c), end: () => {} };
};

describe('HuggingFaceDatasetSource downloads (issue #268)', () => {
  const fetchMock = jest.fn<typeof fetch>();
  let logger: Logger;

  beforeEach(() => {
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
    logger = new Logger('test');
    jest.spyOn(logger, 'log').mockImplementation(() => undefined);
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retries a failed download and succeeds on a later attempt', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(textResponse('{"word":"a"}\n'));
    const source = new HuggingFaceDatasetSource(logger, { attempts: 3, retryDelayMs: 0 });
    try {
      const acquired = await source.acquireFile('vocab-bloom-hub-en-words.jsonl', sink());
      expect(await readFile(acquired.path, 'utf8')).toBe('{"word":"a"}\n');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('retrying'));
    } finally {
      await source.dispose();
    }
  });

  it('gives up after the configured attempts', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    const source = new HuggingFaceDatasetSource(logger, { attempts: 3, retryDelayMs: 0 });
    try {
      await expect(source.acquireFile('x.jsonl', sink())).rejects.toThrow(InternalServerErrorException);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      await source.dispose();
    }
  });

  it('does not retry an HTTP 4xx: the file is not there', async () => {
    fetchMock.mockResolvedValue(textResponse('nope', 404));
    const source = new HuggingFaceDatasetSource(logger, { attempts: 3, retryDelayMs: 0 });
    try {
      await expect(source.acquireFile('x.jsonl', sink())).rejects.toThrow(InternalServerErrorException);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      await source.dispose();
    }
  });

  it('downloads from the requested revision of the dataset repo (issue #322)', async () => {
    fetchMock.mockResolvedValue(textResponse('{"word":"a"}\n'));
    const source = new HuggingFaceDatasetSource(logger, { revision: 'v0.1.0' });

    const acquired = await source.acquireFile('words.jsonl', sink());
    expect(String(fetchMock.mock.calls[0][0])).toContain('/resolve/v0.1.0/data/words.jsonl');
    expect(await readFile(acquired.path, 'utf8')).toBe('{"word":"a"}\n');
    await source.dispose();

    // without a revision the moving main is read
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(textResponse('{"word":"a"}\n'));
    const plain = new HuggingFaceDatasetSource(logger);
    await plain.acquireFile('words.jsonl', sink());
    expect(String(fetchMock.mock.calls[0][0])).toContain('/resolve/main/data/words.jsonl');
    await plain.dispose();
  });

  it('lists the version tags newest first and answers [] when the refs API fails (issue #322)', async () => {
    fetchMock.mockResolvedValue(
      textResponse(JSON.stringify({ tags: [{ name: 'v0.1.0' }, { name: 'v0.2.0' }] })),
    );
    await expect(fetchDatasetRevisions(logger)).resolves.toEqual(['v0.2.0', 'v0.1.0']);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/datasets/');

    fetchMock.mockResolvedValue(textResponse('down', 503));
    await expect(fetchDatasetRevisions(logger)).resolves.toEqual([]);

    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(fetchDatasetRevisions(logger)).resolves.toEqual([]);
  });

  it('abandons a download that stops delivering bytes and retries it', async () => {
    fetchMock.mockResolvedValueOnce(stallingResponse()).mockResolvedValueOnce(textResponse('{"word":"b"}\n'));
    const source = new HuggingFaceDatasetSource(logger, {
      attempts: 2,
      retryDelayMs: 0,
      inactivityTimeoutMs: 100,
    });
    try {
      const acquired = await source.acquireFile('x.jsonl', sink());
      expect(await readFile(acquired.path, 'utf8')).toBe('{"word":"b"}\n');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('no data received for 0.1 s'));
    } finally {
      await source.dispose();
    }
  });
});
