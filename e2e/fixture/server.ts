import http from 'node:http';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';

export interface FixtureServer {
  origin: string;
  url: string;
  close(): Promise<void>;
}

/** Serves index.html on http://localhost:<free port>/. The e2e build holds localhost permission. */
export function startFixtureServer(): Promise<FixtureServer> {
  const indexHtml = fs.readFileSync(new URL('index.html', import.meta.url), 'utf-8');
  const sockets = new Set<import('node:net').Socket>();
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/' || pathname === '/index.html' || pathname === '/other.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(indexHtml);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      const origin = `http://localhost:${port}`;
      resolve({
        origin,
        url: `${origin}/`,
        close: () =>
          new Promise<void>((done) => {
            for (const s of sockets) s.destroy();
            server.close(() => done());
          }),
      });
    });
  });
}
