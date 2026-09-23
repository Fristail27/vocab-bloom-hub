import http from 'node:http';
import https from 'node:https';

const TIMEOUT_MS = 30_000;

/**
 * A GET over node:http, outside Next's patched `fetch` (issue #480). The
 * headword index walks the API from within a page render, and a `fetch`
 * there is a data request of that render: `no-store` would make the page
 * dynamic, a revalidate would put every list page into the data cache. The
 * walk is a process-level job with nothing to do with the render, so it
 * speaks HTTP by itself and answers a plain `Response`
 */
export const nodeFetch = (url: string, headers: Record<string, string> = {}): Promise<Response> =>
  new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const request = client.get(url, { headers: { accept: 'application/json', ...headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => {
        const headers = Object.fromEntries(
          Object.entries(res.headers).flatMap(([name, value]) =>
            typeof value === 'string' ? [[name, value]] : [],
          ),
        );
        const status = res.statusCode ?? 502;
        resolve(new Response(status === 204 ? null : Buffer.concat(chunks), { status, headers }));
      });
    });
    request.on('error', reject);
    request.setTimeout(TIMEOUT_MS, () =>
      request.destroy(new Error(`no answer from ${url} in ${TIMEOUT_MS} ms`)),
    );
  });
