import { chromium, type Browser, type BrowserContext, type BrowserServer, type Page } from 'playwright';
import type { Metrics } from '../domain/models.js';
import { BudgetError, BudgetGuard } from '../security/budget.js';
import { assertAllowedUrl } from '../security/targets.js';
import { redactText } from '../security/redact.js';
import { setTimeout as delay } from 'node:timers/promises';

export interface BrowserObservations { console: Array<{ type: string; text: string }>; network: Array<{ method: string; path: string; status?: number; durationMs?: number; error?: string }>; errors: string[]; blocked: string[]; }
export class BrowserSession {
  private server?: BrowserServer;
  browser?: Browser;
  private closing?: Promise<void>;
  constructor(readonly guard: BudgetGuard, readonly metrics: Metrics, readonly approvedOrigins: string[], readonly forbiddenPorts: number[], readonly onPid: (pid: number) => void) {}
  async start(): Promise<string> {
    this.server = await chromium.launchServer({ headless: true, host: '127.0.0.1', chromiumSandbox: true,
      timeout: 15000, args: ['--disable-background-networking', '--disable-quic', '--force-webrtc-ip-handling-policy=disable_non_proxied_udp'],
    });
    const pid = this.server.process().pid;
    if (pid) this.onPid(pid);
    this.browser = await chromium.connect(this.server.wsEndpoint(), { timeout: 10000 });
    this.guard.signal.addEventListener('abort', () => { void this.close(); }, { once: true });
    this.guard.check(); return this.browser.version();
  }
  async context(contextGuard?: BudgetGuard, trace = true): Promise<{ context: BrowserContext; page: Page; observations: BrowserObservations }> {
    if (!this.browser) throw new Error('Browser is not started');
    const context = await this.browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block', acceptDownloads: false, permissions: [], reducedMotion: 'reduce' });
    context.setDefaultTimeout(2500); context.setDefaultNavigationTimeout(6000);
    const observations: BrowserObservations = { console: [], network: [], errors: [], blocked: [] };
    await context.routeWebSocket('**/*', socket => { observations.blocked.push('WebSocket connections are disabled'); socket.close(); });
    await context.route('**/*', async route => {
      const request = route.request();
      const started = performance.now();
      let url: URL;
      let release: (() => void) | undefined; let releaseContext: (() => void) | undefined;
      try {
        url = assertAllowedUrl(request.url(), this.approvedOrigins, this.forbiddenPorts);
        if (request.postDataBuffer() && request.postDataBuffer()!.length > 16384) throw new BudgetError('Browser request body exceeds 16 KiB');
        release = await this.guard.acquire();
        if (contextGuard) releaseContext = await contextGuard.acquire();
        this.metrics.actualNetworkRequests++;
        const headers = await request.allHeaders();
        delete headers['host']; delete headers['connection']; delete headers['content-length']; delete headers['accept-encoding'];
        // Fulfill from a bounded manual fetch. Chromium never receives a redirect or directly fetches a target URL.
        const requestBody = request.postDataBuffer();
        const response = await fetch(url, { method: request.method(), headers, body: requestBody ? new Uint8Array(requestBody).buffer : undefined,
          redirect: 'manual', signal: AbortSignal.any([this.guard.signal, AbortSignal.timeout(4000)]),
        });
        if (response.status >= 300 && response.status < 400) {
          await response.body?.cancel();
          throw new Error('HTTP redirects are disabled for browser scenarios; use a direct approved URL');
        }
        const reader = response.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
        if (reader) {
          try {
            for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > this.guard.budget.maxResponseBytes) throw new BudgetError('Browser response byte budget exceeded'); chunks.push(part.value); }
          } finally { await reader.cancel(); }
        }
        const durationMs = performance.now() - started;
        this.metrics.latencyMs.push(durationMs);
        if (response.status >= 500) this.metrics.serverErrors++;
        if (response.status === 429 || response.status === 503) this.metrics.rejectedRequests++;
        observations.network.push({ method: request.method(), path: url.pathname, status: response.status, durationMs });
        const responseHeaders = Object.fromEntries(response.headers);
        delete responseHeaders['content-encoding']; delete responseHeaders['content-length']; delete responseHeaders['transfer-encoding'];
        await route.fulfill({ status: response.status, headers: responseHeaders, body: Buffer.concat(chunks) });
      } catch (error) {
        this.metrics.blockedRequests++;
        const cause = error instanceof Error ? (error.cause as { code?: string } | undefined)?.code : undefined;
        const message = redactText(`${cause ? `${cause}: ` : ''}${error instanceof Error && error.name === 'TimeoutError' ? 'TARGET_TIMEOUT: ' : ''}${error instanceof Error ? error.message : String(error)}`);
        observations.blocked.push(message);
        observations.network.push({ method: request.method(), path: '/', error: message });
        try { await route.abort('blockedbyclient'); } catch { /* Context may have closed during cancellation. */ }
      } finally { releaseContext?.(); release?.(); }
    });
    context.on('page', page => {
      if (context.pages().length > 2) { void page.close(); observations.blocked.push('Two-page limit exceeded'); return; }
      page.on('console', msg => { if (observations.console.length < 100) observations.console.push({ type: msg.type(), text: redactText(msg.text()) }); });
      page.on('pageerror', error => { if (observations.errors.length < 50) observations.errors.push(redactText(error.message)); });
      page.on('requestfailed', () => { this.metrics.failedRequests++; });
      page.on('dialog', dialog => { void dialog.dismiss(); });
      page.on('download', download => { void download.cancel(); });
    });
    const page = await context.newPage();
    if (trace) await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
    return { context, page, observations };
  }
  close(): Promise<void> {
    this.closing ??= (async () => {
      if (this.browser) {
        const disconnected = await Promise.race([this.browser.close().then(() => true, () => false), delay(750).then(() => false)]);
        if (!disconnected && this.server) await this.server.kill();
      }
      if (this.server) {
        const closed = await Promise.race([this.server.close().then(() => true, () => false), delay(750).then(() => false)]);
        if (!closed) await this.server.kill();
      }
    })();
    return this.closing;
  }
}
