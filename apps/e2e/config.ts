import * as path from 'path';

export const SERVER_PORT = 3011;
export const FRONT_PORT = 3001;
export const API_URL = `http://localhost:${SERVER_PORT}/api`;
export const APP_URL = `http://localhost:${FRONT_PORT}`;

// The admin credentials the e2e server boots with (see webServer env in
// playwright.config.ts); auth.setup.ts logs in with the same pair through the UI
export const E2E_USERNAME = 'e2e-admin';
export const E2E_PASSWORD = 'e2e-password';

// The website suite (playwright.site.config.ts, issue #330) boots its own
// API + site pair on ports of its own, so the two suites can never collide
export const SITE_PORT = 3021;
export const SITE_API_PORT = 3012;
export const SITE_URL = `http://localhost:${SITE_PORT}`;
export const SITE_API_URL = `http://localhost:${SITE_API_PORT}/api`;

// Holds the isolated sqlite database (wiped by the server webServer command
// before it boots) and the saved browser session (overwritten by auth.setup.ts)
export const TMP_DIR = path.join(__dirname, '.tmp');
export const DB_PATH = path.join(TMP_DIR, 'e2e.sqlite');
export const SITE_DB_PATH = path.join(TMP_DIR, 'site-e2e.sqlite');
export const STORAGE_STATE = path.join(TMP_DIR, 'admin-storage-state.json');
