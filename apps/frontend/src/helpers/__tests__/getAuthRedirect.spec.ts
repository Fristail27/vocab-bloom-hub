import { getAuthRedirect as getAuthRedirectBase } from '../getAuthRedirect';

// Mirrors src/i18n/routing.ts, which cannot be imported here: next-intl ships
// ESM that the jest transform does not process
const routing = { locales: ['en', 'ru'], defaultLocale: 'en' };

const getAuthRedirect = (pathname: string, hasAuthCookie: boolean) =>
  getAuthRedirectBase(pathname, hasAuthCookie, routing);

describe('getAuthRedirect (issue #190)', () => {
  describe('with the auth cookie', () => {
    it('lets every route pass through', () => {
      expect(getAuthRedirect('/en/managing', true)).toBeNull();
      expect(getAuthRedirect('/ru/statistics', true)).toBeNull();
      expect(getAuthRedirect('/', true)).toBeNull();
      expect(getAuthRedirect('/en/login', true)).toBeNull();
    });
  });

  describe('without the auth cookie', () => {
    it('redirects protected routes to the login page of the same locale', () => {
      expect(getAuthRedirect('/en/managing', false)).toBe('/en/login');
      expect(getAuthRedirect('/ru/statistics', false)).toBe('/ru/login');
      expect(getAuthRedirect('/ru', false)).toBe('/ru/login');
    });

    it('falls back to the default locale when the path has no locale prefix', () => {
      expect(getAuthRedirect('/', false)).toBe('/en/login');
      expect(getAuthRedirect('/managing', false)).toBe('/en/login');
      // an unknown first segment is a path, not a locale
      expect(getAuthRedirect('/de/managing', false)).toBe('/en/login');
    });

    it('does not redirect requests already heading to the login page', () => {
      expect(getAuthRedirect('/en/login', false)).toBeNull();
      expect(getAuthRedirect('/ru/login', false)).toBeNull();
      // before the intl middleware adds the locale prefix
      expect(getAuthRedirect('/login', false)).toBeNull();
    });
  });
});
