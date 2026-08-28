import { describe, expect, it } from '@jest/globals';
import { getMetricsPath, isMetricsEnabled } from '../metrics.config';
import { routeTemplate, UNMATCHED_ROUTE } from '../metrics.middleware';

describe('metrics configuration (issue #281)', () => {
  it('is off unless METRICS_ENABLED says so', () => {
    expect(isMetricsEnabled({})).toBe(false);
    expect(isMetricsEnabled({ METRICS_ENABLED: 'false' })).toBe(false);
    expect(isMetricsEnabled({ METRICS_ENABLED: 'true' })).toBe(true);
    expect(isMetricsEnabled({ METRICS_ENABLED: ' 1 ' })).toBe(true);
  });

  it('serves /metrics by default and normalises a custom path', () => {
    expect(getMetricsPath({})).toBe('/metrics');
    expect(getMetricsPath({ METRICS_PATH: 'internal/metrics' })).toBe('/internal/metrics');
    expect(getMetricsPath({ METRICS_PATH: '/prom/' })).toBe('/prom');
    expect(getMetricsPath({ METRICS_PATH: '  ' })).toBe('/metrics');
  });

  it('labels requests by the route template, never by the raw path', () => {
    const req = (route: string | undefined, baseUrl = '') =>
      ({ route: route === undefined ? undefined : { path: route }, baseUrl }) as never;
    expect(routeTemplate(req('/api/v1/words/:word'))).toBe('/api/v1/words/:word');
    expect(routeTemplate(req('/', '/api/v1/search'))).toBe('/api/v1/search/');
    expect(routeTemplate(req(undefined))).toBe(UNMATCHED_ROUTE);
  });
});
