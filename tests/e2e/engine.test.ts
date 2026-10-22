import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { createEngine } from '../../dist/api/server.js';
import { CreateRunSchema, RunSchema, type Run } from '../../src/domain/models.js';
import { ReportSchema } from '../../src/reporting/reports.js';
import { isProcessAlive } from '../../src/workers/processes.js';
import { tempDirectory, removeTestDirectory, waitFor, token } from '../helpers.js';

describe('real Chromium and five-level fixture execution', () => {
  it('detects seeded defects, passes clean controls, streams, replays, compares, and survives restart', async () => {
    const dir = await tempDirectory('five-level'); let engine = await createEngine({ dataDir: dir, token, port: 0, logger: false }); let origin = await engine.listen();
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const post = async (path: string, body: unknown): Promise<Response> => fetch(`${origin}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
    try {
      const runs: Run[] = [];
      for (const variant of ['faulty', 'clean'] as const) {
        const response = await post('/v1/runs', { target: { kind: 'fixture', variant }, levels: [1, 2, 3, 4, 5], allowFixtureFaults: true, useAi: false }); expect(response.status).toBe(202);
        const created = await response.json() as Run; expect(RunSchema.safeParse(created).success).toBe(true);
        const stream = fetch(`${origin}/v1/runs/${created.id}/events`, { headers }).then(r => r.text());
        const run = await waitFor(engine, created.id); runs.push(run); const events = await stream;
        expect(run.state).toBe('completed'); expect(run.results).toHaveLength(8); expect(new Set(run.results.map(r => r.level)).size).toBe(5);
        expect(run.ai.status).toBe('disabled'); expect(events).toContain('event: scenario'); expect(events).toContain('"state":"completed"');
        expect(run.results.filter(r => r.classification === 'confirmed')).toHaveLength(variant === 'faulty' ? 7 : 0);
        expect(run.results.filter(r => r.classification === 'passed')).toHaveLength(variant === 'clean' ? 8 : 1);
        expect(run.evidence.some(e => e.kind === 'screenshot')).toBe(true); expect(run.evidence.some(e => e.kind === 'trace')).toBe(true);
        expect(run.metrics.actualNetworkRequests).toBeLessThanOrEqual(run.request.budget.maxRequests); expect(run.metrics.simulatedEvents).toBe(variant === 'faulty' ? 162 : 81);
        expect(engine.manager.failures).toEqual([]);
        const evidence = run.evidence[0]!; const binary = await readFile(join(engine.config.artifactDir, run.id, evidence.relativePath));
        expect(createHash('sha256').update(binary).digest('hex')).toBe(evidence.sha256);
        const download = await fetch(`${origin}/v1/runs/${run.id}/evidence/${evidence.id}`, { headers }); expect(download.status).toBe(200); expect((await download.arrayBuffer()).byteLength).toBe(evidence.bytes);
        const report = JSON.parse(await readFile(join(engine.config.artifactDir, run.id, 'report.json'), 'utf8'));
        expect(ReportSchema.safeParse(report).success).toBe(true); expect(report.summary.unexecuted).toEqual([]);
        const markdown = await fetch(`${origin}/v1/runs/${run.id}/report?format=markdown`, { headers }).then(r => r.text()); expect(markdown).toContain('Reproduce:');
      }
      const comparison = await (await post('/v1/compare', { before: runs[0]!.id, after: runs[1]!.id })).json() as { changes: Array<{ change: string }> };
      expect(comparison.changes.filter(c => c.change === 'resolved_in_this_run')).toHaveLength(7);
      const replay = await (await post(`/v1/runs/${runs[0]!.id}/replay`, { scenarioIds: ['normal.persistence'] })).json() as Run;
      const replayed = await waitFor(engine, replay.id); expect(replayed.replayOf).toBe(runs[0]!.id); expect(replayed.results[0]?.classification).toBe('confirmed');
      const lastEvent = engine.store.history(runs[0]!.id).at(-1)!;
      const resumed = await fetch(`${origin}/v1/runs/${runs[0]!.id}/events`, { headers: { ...headers, 'Last-Event-ID': String(lastEvent.id - 1) } }).then(r => r.text());
      expect((resumed.match(/event: state/g) ?? []).length).toBe(1);
      await engine.close(); engine = await createEngine({ dataDir: dir, token, port: 0, logger: false }); origin = await engine.listen();
      expect(engine.store.get(runs[0]!.id)?.evidence).toEqual(runs[0]!.evidence); expect(engine.store.get(runs[0]!.id)?.state).toBe('completed');
    } finally { await engine.close(); await removeTestDirectory(dir); }
  });
  it('cancels a real browser run and removes its processes and disposable data', async () => {
    const dir = await tempDirectory('cancel-browser'); const engine = await createEngine({ dataDir: dir, port: 0, logger: false }); await engine.listen();
    try {
      const run = engine.manager.create(CreateRunSchema.parse({ target: { kind: 'fixture', variant: 'clean' } }));
      await waitFor(engine, run.id, r => r.state === 'running' && !!engine.manager.processIds(r.id).browser);
      const pids = engine.manager.processIds(run.id); engine.manager.cancel(run.id); engine.manager.cancel(run.id);
      const cancelled = await waitFor(engine, run.id); expect(cancelled.state).toBe('cancelled'); expect(engine.manager.activeCount).toBe(0);
      expect(isProcessAlive(pids.worker!)).toBe(false); expect(isProcessAlive(pids.browser!)).toBe(false);
      await expect(access(join(engine.config.artifactDir, run.id, 'disposable-fixture'))).rejects.toThrow();
    } finally { await engine.close(); await removeTestDirectory(dir); }
  });
  it('stops at the network budget and marks infrastructure uncertainty instead of a defect', async () => {
    const dir = await tempDirectory('request-budget'); const engine = await createEngine({ dataDir: dir, port: 0, logger: false }); await engine.listen();
    try {
      const run = engine.manager.create(CreateRunSchema.parse({ target: { kind: 'fixture' }, levels: [3], allowFixtureFaults: true, recipeIds: ['hostile.cost'], budget: { maxRequests: 2 } }));
      const completed = await waitFor(engine, run.id);
      expect(completed.state).toBe('partially_completed'); expect(completed.metrics.actualNetworkRequests).toBe(2);
      expect(completed.results[0]?.classification).toBe('inconclusive'); expect(completed.results[0]?.origin).toBe('policy');
      expect(completed.results[0]?.severity).toBe('unassigned');
    } finally { await engine.close(); await removeTestDirectory(dir); }
  });
});
