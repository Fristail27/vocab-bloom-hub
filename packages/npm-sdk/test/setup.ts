import http from 'node:http';

// The suite starts and stops an ephemeral server; one connection per request
// avoids the keep-alive socket reuse race of the server test suites
http.globalAgent = new http.Agent({ keepAlive: false });
process.env.DATABASE_URL = 'sqlite::memory:';
process.env.ADMIN_USERNAME ??= 'sdk-admin';
process.env.ADMIN_PASSWORD ??= 'sdk-password';
