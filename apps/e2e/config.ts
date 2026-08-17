import * as path from 'path';

export const SERVER_PORT = 3011;
export const FRONT_PORT = 3001;
export const API_URL = `http://localhost:${SERVER_PORT}/api`;
export const APP_URL = `http://localhost:${FRONT_PORT}`;

// The admin credentials the e2e server boots with (see webServer env in
// playwright.config.ts); auth.setup.ts logs in with the same pair through the UI
export const E2E_USERNAME = 'e2e-admin';
export const E2E_PASSWORD = 'e2e-password';

// Holds the isolated sqlite database (wiped by the server webServer command
// before it boots) and the saved browser session (overwritten by auth.setup.ts)
export const TMP_DIR = path.join(__dirname, '.tmp');
export const DB_PATH = path.join(TMP_DIR, 'e2e.sqlite');
export const STORAGE_STATE = path.join(TMP_DIR, 'admin-storage-state.json');
