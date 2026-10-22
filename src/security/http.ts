import { assertAllowedUrl } from './targets.js';
import { BudgetGuard, BudgetError } from './budget.js';
import type { Metrics } from '../domain/models.js';

export interface HttpObservation { method: string; path: string; status: number; durationMs: number; }
export class SafeHttp {
  constructor(readonly origins: string[], readonly guard: BudgetGuard, readonly metrics: Metrics, readonly observations: HttpObservation[], readonly forbiddenPorts: number[] = []) {}
  async request(url: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<{ status: number; body: unknown }> {
    let current = assertAllowedUrl(url, this.origins, this.forbiddenPorts);
    for (let redirects = 0; redirects < 4; redirects++) {
      const release = await this.guard.acquire();
      try {
      const started = performance.now();
      this.metrics.actualNetworkRequests++;
      const signal = AbortSignal.any([this.guard.signal, AbortSignal.timeout(4000)]);
      let response: Response;
      try {
        response = await fetch(current, { method: init.method ?? 'GET', redirect: 'manual', signal,
          headers: { 'content-type': 'application/json', ...init.headers },
          ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        });
      } catch (error) { this.metrics.failedRequests++; throw error; }
      const durationMs = performance.now() - started;
      this.metrics.latencyMs.push(durationMs);
      this.observations.push({ method: init.method ?? 'GET', path: current.pathname, status: response.status, durationMs });
      if (response.status >= 500) this.metrics.serverErrors++;
      if (response.status === 429 || response.status === 503) this.metrics.rejectedRequests++;
      if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
        await response.body?.cancel();
        if (init.method && init.method !== 'GET') throw new Error('Redirects of mutations are not followed');
        current = assertAllowedUrl(new URL(response.headers.get('location')!, current).href, this.origins, this.forbiddenPorts);
        continue;
      }
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      if (reader) {
        try {
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.length;
            if (size > this.guard.budget.maxResponseBytes) throw new BudgetError('Response byte budget exceeded');
            chunks.push(chunk.value);
          }
        } finally { await reader.cancel(); }
      }
      const text = Buffer.concat(chunks).toString('utf8');
      let body: unknown = text;
      try { body = JSON.parse(text); } catch { /* Non-JSON is a valid HTTP observation. */ }
      return { status: response.status, body };
      } finally { release(); }
    }
    throw new Error('Redirect limit exceeded');
  }
}
