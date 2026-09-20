import { PROJECT_LATEST_RELEASE_API_URL } from '../../../../core/constants/project_links';
import type { SettingsService } from '../settings.service';
import { UPDATE_CHECK_FAILURE_TTL_MS, UPDATE_CHECK_TTL_MS, UpdateCheckService } from '../update-check.service';

const release = (tag: string) =>
  ({
    ok: true,
    status: 200,
    json: async () => ({
      tag_name: tag,
      html_url: `https://github.com/Fristail27/vocab-bloom-hub/releases/tag/${tag}`,
    }),
  }) as unknown as Response;

describe('UpdateCheckService (issue #477)', () => {
  const fetchMock = jest.fn();
  const realFetch = global.fetch;
  let service: UpdateCheckService;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-09-20T12:00:00Z') });
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    delete process.env.UPDATE_CHECK;
    service = new UpdateCheckService({ getVersion: () => '1.0.0' } as unknown as SettingsService);
    // the failure path logs a warning by design
    jest
      .spyOn((service as unknown as { logger: { warn: () => void } }).logger, 'warn')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = realFetch;
    delete process.env.UPDATE_CHECK;
  });

  it('reports a newer stable release with its notes', async () => {
    fetchMock.mockResolvedValue(release('v1.1.0'));

    await expect(service.check()).resolves.toEqual({
      enabled: true,
      current: '1.0.0',
      latest: '1.1.0',
      update_available: true,
      release_url: 'https://github.com/Fristail27/vocab-bloom-hub/releases/tag/v1.1.0',
      checked_at: '2026-09-20T12:00:00.000Z',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(PROJECT_LATEST_RELEASE_API_URL);
    // GitHub rejects a request without a User-Agent
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('vocab-bloom-hub/1.0.0');
  });

  it('says nothing is available on the latest release', async () => {
    fetchMock.mockResolvedValue(release('v1.0.0'));
    const result = await service.check();
    expect(result).toMatchObject({ latest: '1.0.0', update_available: false });
  });

  it('asks GitHub once within the cache period, and again after it', async () => {
    fetchMock.mockResolvedValue(release('v1.1.0'));
    await service.check();
    await service.check();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(UPDATE_CHECK_TTL_MS + 1);
    await service.check();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shares one request between concurrent checks', async () => {
    fetchMock.mockResolvedValue(release('v1.1.0'));
    await Promise.all([service.check(), service.check(), service.check()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a network error', () => Promise.reject(new Error('getaddrinfo ENOTFOUND api.github.com'))],
    ['a rate-limit answer', () => Promise.resolve({ ok: false, status: 403 } as Response)],
    ['a release without a version tag', () => Promise.resolve(release('nightly'))],
    [
      'a malformed body',
      () => Promise.resolve({ ok: true, status: 200, json: async () => 'oops' } as unknown as Response),
    ],
  ])('answers "unknown" on %s, never an error', async (_name, answer) => {
    fetchMock.mockImplementation(answer);

    await expect(service.check()).resolves.toMatchObject({
      enabled: true,
      latest: null,
      update_available: false,
      release_url: null,
    });
  });

  it('remembers a failure for a shorter period than a success', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'));
    await service.check();
    await service.check();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValue(release('v1.1.0'));
    jest.advanceTimersByTime(UPDATE_CHECK_FAILURE_TTL_MS + 1);
    await expect(service.check()).resolves.toMatchObject({ latest: '1.1.0', update_available: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stays silent with UPDATE_CHECK=false: no outgoing request', async () => {
    process.env.UPDATE_CHECK = 'false';

    await expect(service.check()).resolves.toEqual({
      enabled: false,
      current: '1.0.0',
      latest: null,
      update_available: false,
      release_url: null,
      checked_at: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
