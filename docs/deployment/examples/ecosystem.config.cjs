// PM2 process file for both apps (docs/deployment/README.md). From the
// repository root, after `yarn build`:
//   pm2 start docs/deployment/examples/ecosystem.config.cjs
//   pm2 save && pm2 startup     # restart with the host
// PM2 stops a process with SIGTERM and waits kill_timeout before SIGKILL:
// keep it above SHUTDOWN_TIMEOUT (30 s by default) so the server can drain.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
// one environment file for both processes, kept outside the repository
const envFile = process.env.ENV_FILE || path.join(root, '.env');
// `next start` does not know ENV_FILE: its variables (NEXT_PUBLIC_BASE_API_URL
// for server-side rendering, PORT) are read here and handed to the process
const dotenv = require(path.join(root, 'node_modules/dotenv'));
const fileEnv = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {};

module.exports = {
  apps: [
    {
      name: 'vocab-bloom-hub-server',
      cwd: path.join(root, 'apps/server'),
      script: 'dist/src/main.js',
      // the server loads ENV_FILE itself and exits when it is missing
      env: { NODE_ENV: 'production', ENV_FILE: envFile },
      kill_timeout: 45_000,
      autorestart: true,
      restart_delay: 5_000,
    },
    {
      name: 'vocab-bloom-hub-frontend',
      cwd: path.join(root, 'apps/frontend'),
      // next is hoisted to the root node_modules by the workspace install;
      // `next start` listens on PORT and reads NEXT_PUBLIC_* at build time
      script: path.join(root, 'node_modules/next/dist/bin/next'),
      args: 'start',
      env: { ...fileEnv, NODE_ENV: 'production', PORT: process.env.PORT || fileEnv.PORT || '3000' },
      kill_timeout: 30_000,
      autorestart: true,
      restart_delay: 5_000,
    },
  ],
};
