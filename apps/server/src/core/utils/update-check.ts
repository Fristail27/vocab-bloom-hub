import { parseFlag } from './public-api';

/**
 * The update notice of the admin UI (issue #477): the server asks GitHub for
 * the latest stable release a few times a day and the admin UI says when it is
 * newer than the running version. `UPDATE_CHECK=false` keeps a self-hosted
 * instance silent — no outgoing request at all.
 */
export const isUpdateCheckEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  parseFlag('UPDATE_CHECK', env.UPDATE_CHECK);

/** Validates the setting at startup; throws ConfigurationError */
export const assertUpdateCheckConfig = (env: NodeJS.ProcessEnv = process.env): void => {
  isUpdateCheckEnabled(env);
};

export type ParsedVersionT = { release: [number, number, number]; prerelease: string[] };

// MAJOR.MINOR.PATCH with an optional `v`, a prerelease and build metadata
// (https://semver.org): `v1.2.3`, `1.2.3-beta.1`, `1.2.3+build.5`
const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/** null for anything that is not a semantic version — a tag named by hand, an empty string */
export const parseVersion = (raw: string | null | undefined): ParsedVersionT | null => {
  const match = VERSION_PATTERN.exec((raw ?? '').trim());
  if (!match) return null;
  return {
    release: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ? match[4].split('.') : [],
  };
};

const comparePrerelease = (a: string[], b: string[]): number => {
  // a version without a prerelease is the newer one: 1.0.0 > 1.0.0-rc.1
  if (a.length === 0 || b.length === 0) return a.length === b.length ? 0 : a.length === 0 ? 1 : -1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const left = a[i];
    const right = b[i];
    // the shorter list is the older one when everything before it is equal
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    const leftNumeric = /^\d+$/.test(left);
    const rightNumeric = /^\d+$/.test(right);
    if (leftNumeric && rightNumeric) {
      if (Number(left) !== Number(right)) return Number(left) < Number(right) ? -1 : 1;
    } else if (leftNumeric !== rightNumeric) {
      // numeric identifiers sort before alphanumeric ones
      return leftNumeric ? -1 : 1;
    } else if (left !== right) {
      return left < right ? -1 : 1;
    }
  }
  return 0;
};

/** Semantic-version order, never string order: 1.10.0 is newer than 1.9.0 */
export const compareVersions = (a: ParsedVersionT, b: ParsedVersionT): number => {
  for (let i = 0; i < 3; i++) {
    if (a.release[i] !== b.release[i]) return a.release[i] < b.release[i] ? -1 : 1;
  }
  return comparePrerelease(a.prerelease, b.prerelease);
};

/** Whether `latest` is a newer version than `current`; false when either is not a version */
export const isNewerVersion = (
  latest: string | null | undefined,
  current: string | null | undefined,
): boolean => {
  const parsedLatest = parseVersion(latest);
  const parsedCurrent = parseVersion(current);
  if (!parsedLatest || !parsedCurrent) return false;
  return compareVersions(parsedLatest, parsedCurrent) > 0;
};
