import { access, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { ENGINE_VERSION } from '../domain/models.js';
import type { RunStore } from '../persistence/store.js';

export interface Readiness {
  ok: boolean; version: string; checks: { storage: boolean; worker: boolean; chromium: boolean };
  issues: Array<{ code: string; message: string }>;
}
/** Coalesce probes so readiness polling cannot spawn unbounded browsers. No target is visited. */
export class RuntimeReadiness {
  private pending?: Promise<Readiness>;
  private cached?: { until: number; value: Readiness };
  constructor(private readonly store: RunStore, private readonly artifactDir: string, private readonly workerPath: string) {}
  check(): Promise<Readiness> {
    if (this.cached && Date.now() < this.cached.until) return Promise.resolve(this.cached.value);
    if (this.pending) return this.pending;
    this.pending = this.probe().then(value => { this.cached = { until: Date.now() + (value.ok ? 30000 : 5000), value }; return value; }).finally(() => { this.pending = undefined; });
    return this.pending;
  }
  async close(): Promise<void> { await this.pending; }
  private async probe(): Promise<Readiness> {
    const checks = { storage: false, worker: false, chromium: false }; const issues: Readiness['issues'] = [];
    const probe = join(this.artifactDir, `.readiness-${randomUUID()}`);
    try { this.store.ready(); await writeFile(probe, '', { flag: 'wx', mode: 0o600 }); await unlink(probe); checks.storage = true; }
    catch { issues.push({ code: 'STORAGE_UNAVAILABLE', message: 'History or evidence storage is unavailable. Check local directory access and free space.' }); }
    try { await access(this.workerPath); checks.worker = true; }
    catch { issues.push({ code: 'WORKER_UNAVAILABLE', message: 'Compiled worker is unavailable. Build the backend before starting the service.' }); }
    let browser: Awaited<ReturnType<typeof chromium.launchServer>> | undefined;
    try {
      browser = await chromium.launchServer({ headless: true, host: '127.0.0.1', chromiumSandbox: true, timeout: 5000 });
      checks.chromium = true;
    } catch { issues.push({ code: 'BROWSER_UNAVAILABLE', message: 'Chromium could not start. Install the matching Playwright browser and verify local runtime dependencies.' }); }
    finally { if (browser) await browser.close().catch(async () => { checks.chromium = false; await browser!.kill(); }); }
    if (!checks.chromium && !issues.some(issue => issue.code === 'BROWSER_UNAVAILABLE')) issues.push({ code: 'BROWSER_UNAVAILABLE', message: 'Chromium readiness cleanup failed; inspect the local runtime.' });
    return { ok: Object.values(checks).every(Boolean), version: ENGINE_VERSION, checks, issues };
  }
}
