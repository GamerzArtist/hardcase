import { describe, it, expect, vi } from 'vitest';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createEngine } from '../../src/api/server.js';
import { CreateRunSchema, RunSchema } from '../../src/domain/models.js';
import { isProcessAlive } from '../../src/workers/processes.js';
import { tempDirectory, removeTestDirectory, token, waitFor } from '../helpers.js';
import * as reports from '../../src/reporting/reports.js';

describe('authenticated API and durable worker lifecycle', () => {
  it('lets cancellation win while final report files are being written', async () => {
    const dir = await tempDirectory('cancel-finalization');
    const original = reports.saveReports; let resume!: () => void; let reached!: () => void;
    const entered = new Promise<void>(resolve => { reached = resolve; });
    const gate = new Promise<void>(resolve => { resume = resolve; });
    const spy = vi.spyOn(reports, 'saveReports').mockImplementation(async (run, directory, baseline) => {
      if (run.state === 'completed') { reached(); await gate; }
      return original(run, directory, baseline);
    });
    const engine = await createEngine({ dataDir: dir, port: 0, logger: false }, { workerPath: resolve('tests/support/controlled-worker.mjs') }); await engine.listen();
    try {
      const run = engine.manager.create(CreateRunSchema.parse({ target: { kind: 'fixture' }, goals: 'complete' }));
      await entered; engine.manager.cancel(run.id); resume();
      const cancelled = await waitFor(engine, run.id); expect(cancelled.state).toBe('cancelled');
      const report = JSON.parse(await readFile(resolve(engine.config.artifactDir, run.id, 'report.json'), 'utf8')) as { run: { state: string } };
      expect(report.run.state).toBe('cancelled');
    } finally { resume(); await engine.close(); spy.mockRestore(); await removeTestDirectory(dir); }
  });
  it('validates input, local authentication, host, CORS, and generated contracts', async () => {
    const dir = await tempDirectory('api'); const engine = await createEngine({ dataDir: dir, token, port: 0, logger: false, allowedOrigins: ['http://127.0.0.1:5173'] }); const origin = await engine.listen();
    const headers = { authorization: `Bearer ${token}`, host: new URL(origin).host };
    try {
      expect((await engine.app.inject({ url: '/v1/health', headers: { host: headers.host } })).statusCode).toBe(200);
      expect((await engine.app.inject({ url: '/v1/runs', headers: { host: headers.host } })).statusCode).toBe(401);
      expect((await engine.app.inject({ url: '/v1/runs', headers: { ...headers, host: 'evil.example' } })).statusCode).toBe(403);
      expect((await engine.app.inject({ url: '/v1/runs', headers: { ...headers, origin: 'https://evil.example' } })).statusCode).toBe(403);
      expect((await engine.app.inject({ method: 'OPTIONS', url: '/v1/runs', headers: { host: headers.host, origin: 'http://127.0.0.1:5173' } })).statusCode).toBe(204);
      for (const payload of [ { target: { kind: 'fixture' }, unexpected: true }, { target: { kind: 'fixture' }, budget: { maxRequests: 100000 } }, { target: { kind: 'loopback', baseUrl: origin, approvedOrigins: [origin], acknowledgeOwnership: true } }, { target: { kind: 'fixture' }, recipeIds: ['shell'] } ]) {
        expect((await engine.app.inject({ method: 'POST', url: '/v1/runs', headers, payload })).statusCode).toBe(400);
      }
      const spec = (await engine.app.inject({ url: '/v1/openapi.json', headers })).json<{ openapi: string; paths: Record<string, unknown>; components: unknown }>();
      expect(spec.openapi).toBe('3.1.0'); expect(spec.paths['/v1/runs/{id}/report']).toBeTruthy(); expect(spec.paths['/v1/runs/{id}/events']).toBeTruthy(); expect(spec.components).toBeTruthy();
      expect((await engine.app.inject({ url: '/v1/runs/not-an-id', headers })).statusCode).toBe(400);
      expect((await engine.app.inject({ url: '/v1/runs?limit=10000', headers })).statusCode).toBe(400);
    } finally { await engine.close(); await removeTestDirectory(dir); }
  });
  it('runs queued jobs in FIFO order and cancels a queued job idempotently', async () => {
    const dir = await tempDirectory('fifo'); const engine = await createEngine({ dataDir: dir, port: 0, logger: false }, { workerPath: resolve('tests/support/controlled-worker.mjs') }); await engine.listen();
    try {
      const input = CreateRunSchema.parse({ target: { kind: 'fixture' }, levels: [3], goals: 'complete' });
      const a = engine.manager.create(input); const b = engine.manager.create(input); const c = engine.manager.create(input);
      engine.manager.cancel(c.id); engine.manager.cancel(c.id);
      await waitFor(engine, b.id);
      expect(engine.store.get(a.id)?.state).toBe('completed'); expect(engine.store.get(c.id)?.state).toBe('cancelled');
      const aEnd = engine.store.history(a.id).find(e => e.data.state === 'completed')!.id;
      const bStart = engine.store.history(b.id).find(e => e.data.state === 'preparing')!.id;
      expect(bStart).toBeGreaterThan(aEnd); expect(RunSchema.safeParse(engine.store.get(b.id)).success).toBe(true);
    } finally { await engine.close(); await removeTestDirectory(dir); }
  });
  it('cleans up the browser after an uncooperative worker crashes', async () => {
    const dir = await tempDirectory('crash'); const engine = await createEngine({ dataDir: dir, port: 0, logger: false }, { workerPath: resolve('tests/support/controlled-worker.mjs') }); await engine.listen();
    try {
      const run = engine.manager.create(CreateRunSchema.parse({ target: { kind: 'fixture' }, goals: 'crash-with-browser' }));
      await waitFor(engine, run.id, () => !!engine.manager.processIds(run.id).browser, 15000);
      const pids = engine.manager.processIds(run.id); const completed = await waitFor(engine, run.id, undefined, 15000);
      expect(completed.state).toBe('failed'); expect(completed.error).toContain('47');
      expect(isProcessAlive(pids.worker!)).toBe(false); expect(isProcessAlive(pids.browser!)).toBe(false);
    } finally { await engine.close(); await removeTestDirectory(dir); }
  });
  it.each(['hang', 'heartbeat-loss'] as const)('forces cleanup on %s and remains responsive', async mode => {
    const dir = await tempDirectory(mode); const engine = await createEngine({ dataDir: dir, port: 0, logger: false, cancellationGraceMs: 100, heartbeatTimeoutMs: mode === 'hang' ? 10000 : 1000 }, { workerPath: resolve('tests/support/controlled-worker.mjs') }); const origin = await engine.listen();
    try {
      const run = engine.manager.create(CreateRunSchema.parse({ target: { kind: 'fixture' }, goals: mode, budget: { maxDurationMs: mode === 'hang' ? 1000 : 10000 } }));
      await waitFor(engine, run.id, r => r.state === 'preparing'); const pid = engine.manager.processIds(run.id).worker;
      const started = performance.now(); expect((await fetch(`${origin}/v1/health`)).status).toBe(200); expect(performance.now() - started).toBeLessThan(1000);
      const completed = await waitFor(engine, run.id, undefined, 15000);
      expect(completed.state).toBe(mode === 'hang' ? 'timed_out' : 'failed'); expect(isProcessAlive(pid!)).toBe(false);
    } finally { await engine.close(); await removeTestDirectory(dir); }
  });
});
