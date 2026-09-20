import { ConfigurationError } from '../../../../configuration';
import {
  assertUpdateCheckConfig,
  compareVersions,
  isNewerVersion,
  isUpdateCheckEnabled,
  parseVersion,
} from '../update-check';

describe('update check: the setting (issue #477)', () => {
  it('is on by default and follows UPDATE_CHECK', () => {
    expect(isUpdateCheckEnabled({})).toBe(true);
    expect(isUpdateCheckEnabled({ UPDATE_CHECK: '' })).toBe(true);
    expect(isUpdateCheckEnabled({ UPDATE_CHECK: 'true' })).toBe(true);
    expect(isUpdateCheckEnabled({ UPDATE_CHECK: 'false' })).toBe(false);
    expect(isUpdateCheckEnabled({ UPDATE_CHECK: '0' })).toBe(false);
    expect(isUpdateCheckEnabled({ UPDATE_CHECK: 'OFF' })).toBe(false);
  });

  it('fails startup on anything but a boolean word', () => {
    expect(() => assertUpdateCheckConfig({ UPDATE_CHECK: 'sometimes' })).toThrow(ConfigurationError);
    expect(() => assertUpdateCheckConfig({ UPDATE_CHECK: 'false' })).not.toThrow();
  });
});

describe('update check: versions', () => {
  it('parses a semantic version with or without the v, a prerelease and build metadata', () => {
    expect(parseVersion('v1.2.3')).toEqual({ release: [1, 2, 3], prerelease: [] });
    expect(parseVersion('1.2.3-beta.1')).toEqual({ release: [1, 2, 3], prerelease: ['beta', '1'] });
    expect(parseVersion(' 1.2.3+build.5 ')).toEqual({ release: [1, 2, 3], prerelease: [] });
  });

  it.each(['', 'latest', '1.2', 'v1', 'nightly-2026-09-20', '1.2.3.4', null, undefined])(
    'answers null for %p',
    (raw) => {
      expect(parseVersion(raw)).toBeNull();
    },
  );

  it('orders versions by number, not by string', () => {
    const order = (a: string, b: string) => compareVersions(parseVersion(a)!, parseVersion(b)!);
    expect(order('1.10.0', '1.9.0')).toBe(1);
    expect(order('1.0.1', '1.0.0')).toBe(1);
    expect(order('2.0.0', '1.99.99')).toBe(1);
    expect(order('1.0.0', 'v1.0.0')).toBe(0);
    expect(order('1.0.0', '1.0.1')).toBe(-1);
  });

  it('orders prereleases the semver way', () => {
    const order = (a: string, b: string) => compareVersions(parseVersion(a)!, parseVersion(b)!);
    // a release is newer than its own prereleases
    expect(order('1.0.0', '1.0.0-rc.1')).toBe(1);
    expect(order('1.0.0-beta.2', '1.0.0-beta.10')).toBe(-1);
    expect(order('1.0.0-alpha.3', '1.0.0-beta.1')).toBe(-1);
    expect(order('1.0.0-beta', '1.0.0-beta.1')).toBe(-1);
    // numeric identifiers sort before alphanumeric ones
    expect(order('1.0.0-1', '1.0.0-alpha')).toBe(-1);
  });

  it('tells whether the latest release is newer than the running version', () => {
    expect(isNewerVersion('v1.1.0', '1.0.0')).toBe(true);
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
    // an instance on a prerelease of the next version is not offered the older stable one
    expect(isNewerVersion('1.0.0', '1.1.0-beta.1')).toBe(false);
    expect(isNewerVersion('1.1.0', '1.1.0-beta.1')).toBe(true);
    // unknown on either side is never "newer"
    expect(isNewerVersion(null, '1.0.0')).toBe(false);
    expect(isNewerVersion('1.1.0', '')).toBe(false);
    expect(isNewerVersion('nightly', '1.0.0')).toBe(false);
  });
});
