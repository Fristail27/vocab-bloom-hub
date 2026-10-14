import type { ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { PublicCacheInterceptor, PublicDatasetsCacheInterceptor } from '../public-cache.interceptor';
import type { DatasetsLastModifiedService } from '../datasets-last-modified.service';
import type { DictionaryLastModifiedService } from '../dictionary-last-modified.service';

describe('public cache conditional requests', () => {
  const instant = new Date('2026-10-14T12:00:00Z');
  const lastModified = { getLastModified: async () => instant };

  it.each(['GET', 'HEAD'])('uses ETag, not a rounded date, for dataset %s responses', async (method) => {
    const headers = { 'if-modified-since': instant.toUTCString(), 'if-none-match': 'W/"old"' };
    const response = { setHeader: jest.fn() };
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ method, headers }), getResponse: () => response }),
    } as unknown as ExecutionContext;
    const interceptor = new PublicDatasetsCacheInterceptor(lastModified as DatasetsLastModifiedService);
    await lastValueFrom(interceptor.intercept(context, { handle: () => of({ data: [] }) }));
    expect(headers).toEqual({ 'if-none-match': 'W/"old"' });
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, no-cache, must-revalidate');
    expect(response.setHeader).toHaveBeenCalledWith('Last-Modified', instant.toUTCString());
    expect(response.setHeader).toHaveBeenCalledWith('ETag', expect.any(String));
  });

  it('preserves date validators for ordinary active-dataset reads', async () => {
    const headers = { 'if-modified-since': instant.toUTCString() };
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', headers }),
        getResponse: () => ({ setHeader: jest.fn() }),
      }),
    } as unknown as ExecutionContext;
    const interceptor = new PublicCacheInterceptor(lastModified as DictionaryLastModifiedService);
    await lastValueFrom(interceptor.intercept(context, { handle: () => of({ data: [] }) }));
    expect(headers['if-modified-since']).toBe(instant.toUTCString());
  });
});
