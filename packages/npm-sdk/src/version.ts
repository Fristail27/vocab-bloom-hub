import pkg from '../package.json';

/** The version of this package, the one the monorepo release carries (issue #408) */
export const SDK_VERSION: string = pkg.version;

/**
 * Sent as `User-Agent` unless the caller overrides the header, so an
 * operator can tell SDK traffic apart in the request log. Browsers own the
 * header and drop the value silently — that is fine, the page identifies
 * itself through the origin
 */
export const USER_AGENT = `vocab-bloom-hub-npm/${SDK_VERSION}`;
