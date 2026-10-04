import { Logger } from '@nestjs/common';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { downloadFile } from '../downloadFile';

describe('bounded source downloads', () => {
  let dir: string;
  const logger = new Logger('download-test');
  const progress = { start: () => {}, write: jest.fn(), end: () => {} };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'vbh-download-test-'));
    jest.spyOn(logger, 'error').mockImplementation(() => {});
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    progress.write.mockClear();
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it.each([true, false])(
    'rejects oversized files and deletes partial data (length header: %s)',
    async (header) => {
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response('too large', {
          headers: header ? { 'content-length': '9' } : {},
        }),
      );
      await expect(
        downloadFile('https://example.test/source', join(dir, 'file'), logger, progress, {
          maxBytes: 4,
          retryDelayMs: 0,
        }),
      ).rejects.toThrow('download limit');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(await readdir(dir)).toEqual([]);
      expect(progress.write).not.toHaveBeenCalledWith(expect.objectContaining({ percent: 100 }));
    },
  );

  it('retries a truncated response and reports completion only after writing the complete file', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('cut', { headers: { 'content-length': '8' } }))
      .mockResolvedValueOnce(new Response('complete', { headers: { 'content-length': '8' } }));
    const file = join(dir, 'file');
    await downloadFile('https://example.test/source', file, logger, progress, { retryDelayMs: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await readFile(file, 'utf8')).toBe('complete');
    expect(progress.write).toHaveBeenLastCalledWith(expect.objectContaining({ percent: 100, downloaded: 8 }));
  });

  it('removes partial data after a stalled transfer exhausts its attempts', async () => {
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('partial'));
        },
      }),
    );
    jest.spyOn(global, 'fetch').mockResolvedValue(response);
    await expect(
      downloadFile('https://example.test/source', join(dir, 'file'), logger, progress, {
        inactivityTimeoutMs: 20,
        attempts: 1,
      }),
    ).rejects.toThrow('no data received');
    expect(await readdir(dir)).toEqual([]);
  });
});
