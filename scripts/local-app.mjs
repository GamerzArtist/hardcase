import { createServer, request as proxyRequest } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const development = process.argv.includes('--dev');
const webPort = Number(process.env.HARDCASE_WEB_PORT || 4327);
if (!Number.isInteger(webPort) || webPort < 1024 || webPort > 65535) throw new Error('Invalid HARDCASE_WEB_PORT.');
const internalOrigin = `http://127.0.0.1:${webPort}`;
const webOrigin = process.env.HARDCASE_PUBLIC_ORIGIN || internalOrigin;
const publicUrl = new URL(webOrigin);
const publicMode = webOrigin !== internalOrigin;
const gatewaySecret = process.env.HARDCASE_GATEWAY_SECRET || '';
if (publicUrl.origin !== webOrigin || (publicMode && (publicUrl.protocol !== 'https:' || gatewaySecret.length < 32))) throw new Error('Public mode requires an exact HTTPS origin and a private gateway secret of at least 32 characters.');
const bindHost = publicMode ? '0.0.0.0' : '127.0.0.1';
const dataDir = resolve(process.env.ENGINE_DATA_DIR || resolve(root, '.engine', 'local-app'));
const { createEngine } = await import('../dist/api/server.js');
const engine = await createEngine({ dataDir, artifactDir: resolve(dataDir, 'artifacts'), port: Number(process.env.ENGINE_PORT || 0), allowedOrigins: [internalOrigin, 'tauri://localhost', 'http://tauri.localhost'], logger: false });
let web;
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  if (web) await web.close();
  await engine.close();
}
try {
  await engine.listen();
  const session = JSON.parse(await readFile(resolve(dataDir, 'session.json'), 'utf8'));
  const access = (request, response) => {
    const supplied = Buffer.from(String(request.headers['x-hardcase-gateway'] || ''));
    const expected = Buffer.from(gatewaySecret);
    if (request.headers.host !== publicUrl.host || (publicMode && (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)))) {
      response.writeHead(403); response.end('Application access required.'); return false;
    }
    return true;
  };
  const applicationApi = (request, response, next) => {
    if (!access(request, response)) return;
    if (request.url?.split('?')[0] === '/healthz') {
      void fetch(session.origin + '/v1/ready', { headers: { Authorization: `Bearer ${session.token}` }, signal: AbortSignal.timeout(3000) }).then(async result => { response.writeHead(result.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(await result.text()); }).catch(() => { response.writeHead(503); response.end('Engine not ready.'); });
      return;
    }
    if (!request.url?.startsWith('/api/')) return next();
    if (!request.url.startsWith('/api/v1/') || (request.headers.origin && request.headers.origin !== webOrigin)) { response.writeHead(403); response.end('Same-origin API access required.'); return; }
    const headers = { host: new URL(session.origin).host, origin: internalOrigin };
    for (const key of ['authorization', 'content-type', 'accept', 'idempotency-key', 'last-event-id']) if (request.headers[key]) headers[key] = request.headers[key];
    const upstream = proxyRequest(new URL(request.url.slice(4), session.origin), { method: request.method, headers }, result => {
      const returned = {};
      for (const key of ['content-type', 'content-disposition', 'cache-control', 'x-content-type-options', 'retry-after']) if (result.headers[key]) returned[key] = result.headers[key];
      returned['Cache-Control'] = 'no-store';
      response.writeHead(result.statusCode || 502, returned); result.pipe(response);
    });
    upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end('The local engine connection was interrupted.'); });
    response.on('close', () => upstream.destroy()); request.pipe(upstream);
  };
  const bootstrap = (request, response, next) => {
    if (request.url?.split('?')[0] !== '/__hardcase/session') return next();
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const origin = request.headers.origin;
    const site = request.headers['sec-fetch-site'];
    if (request.method !== 'GET' || request.headers.host !== new URL(webOrigin).host || request.headers['x-hardcase-bootstrap'] !== '1' || (origin && origin !== webOrigin) || (site && site !== 'same-origin' && site !== 'none')) {
      response.writeHead(403); response.end('Local application access required.'); return;
    }
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ origin: webOrigin + '/api', token: session.token }));
  };
  if (development) {
    const { createServer: createVite } = await import('vite');
    if (publicMode) throw new Error('Public mode requires a production build, not the Vite development server.');
    web = await createVite({ root: resolve(root, 'apps/web'), server: { host: '127.0.0.1', port: webPort, strictPort: true }, plugins: [{ name: 'hardcase-private-bootstrap', configureServer(server) { server.middlewares.use(applicationApi); server.middlewares.use(bootstrap); } }] });
    await web.listen();
  } else {
    const publicDir = resolve(root, 'apps/web/dist');
    await stat(resolve(publicDir, 'index.html'));
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8' };
    const server = createServer((request, response) => {
      applicationApi(request, response, () => bootstrap(request, response, () => void (async () => {
        try {
          if (!['GET', 'HEAD'].includes(request.method || '')) { response.writeHead(405); response.end(); return; }
          const pathname = decodeURIComponent(new URL(request.url || '/', webOrigin).pathname);
          let path = resolve(publicDir, `.${pathname}`);
          if (path !== publicDir && !path.startsWith(publicDir + sep)) { response.writeHead(403); response.end(); return; }
          if (!extname(path)) path = resolve(publicDir, 'index.html');
          const bytes = await readFile(path);
          response.setHeader('X-Content-Type-Options', 'nosniff');
          response.setHeader('Referrer-Policy', 'no-referrer');
          response.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
          response.setHeader('Cache-Control', pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
          response.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`);
          response.writeHead(200); response.end(request.method === 'HEAD' ? undefined : bytes);
        } catch { response.writeHead(404); response.end('Not found.'); }
      })()));
    });
    await new Promise((ok, fail) => { server.once('error', fail); server.listen(webPort, bindHost, ok); });
    web = { close: () => new Promise((ok, fail) => { server.close(error => error ? fail(error) : ok()); server.closeAllConnections(); }) };
  }
  console.log(`hardcase is ready: ${webOrigin}\nWorkspace: ${webOrigin}/app\nLocal history: ${dataDir}\nPress Ctrl+C to stop the application and engine.`);
  process.send?.({ type: 'ready', origin: webOrigin, sessionFile: resolve(dataDir, 'session.json') });
} catch (error) { await shutdown(); throw error; }
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => void shutdown().then(() => process.exit(0)));
process.on('message', message => { if (message?.type === 'shutdown') void shutdown().then(() => process.exit(0)); });
