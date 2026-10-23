import { describe, it, expect } from 'vitest';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createEngine } from '../../dist/api/server.js';
import { type Run, ScenarioSchema } from '../../src/domain/models.js';
import { ReadinessSchema } from '../../src/api/contracts.js';
import { tempDirectory, removeTestDirectory, token, waitFor } from '../helpers.js';

describe('observed release browser and evidence failures', () => {
  it('captures a reproducible browser permission failure, hashes downloads, and deduplicates replay', async () => {
    const dir = await tempDirectory('release-permission'); const engine = await createEngine({ dataDir: dir, port: 0, token, logger: false }); const origin = await engine.listen();
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const post = (path: string, body: unknown, key: string) => fetch(`${origin}${path}`, { method: 'POST', headers: { ...headers, 'idempotency-key': key }, body: JSON.stringify(body) });
    try {
      const readiness = await fetch(`${origin}/v1/ready`, { headers }); expect(readiness.status).toBe(200); expect(ReadinessSchema.parse(await readiness.json()).checks).toEqual({ storage: true, worker: true, chromium: true });
      const input = { target: { kind: 'fixture', variant: 'faulty' }, levels: [3], recipeIds: ['hostile.authorization'], allowFixtureFaults: true };
      const created = await post('/v1/runs', input, 'browser-permission-001').then(r => r.json()) as Run;
      const complete = await waitFor(engine, created.id); expect(complete.state).toBe('completed');
      const result = complete.results[0]!; expect(result.version).toBe(2); expect(result.classification).toBe('confirmed'); expect(result.verification.matchingAssertionIds).toEqual(['viewer-denied', 'no-unauthorized-effect']);
      expect(result.attempts).toHaveLength(2); expect(result.attempts[0]!.actions.some(a => a.action === 'click')).toBe(true);
      expect(result.attempts[0]!.assertions.find(a => a.id === 'viewer-denied')?.observed).toBe(200);
      const screenshot = complete.evidence.find(e => e.scenarioId === result.scenarioId && e.kind === 'screenshot')!; expect(screenshot).toBeTruthy(); expect(Date.parse(screenshot.createdAt)).toBeGreaterThanOrEqual(Date.parse(result.firstObservedAt));
      const url = `${origin}/v1/runs/${complete.id}/evidence/${screenshot.id}`;
      expect((await fetch(url)).status).toBe(401);
      const download = await fetch(url, { headers }); expect(download.status).toBe(200);
      const bytes = Buffer.from(await download.arrayBuffer()); expect(bytes.byteLength).toBe(screenshot.bytes); expect(createHash('sha256').update(bytes).digest('hex')).toBe(screenshot.sha256);
      const replayResponses = await Promise.all([post(`/v1/runs/${complete.id}/replay`, { scenarioIds: [result.scenarioId] }, 'browser-replay-001'), post(`/v1/runs/${complete.id}/replay`, { scenarioIds: [result.scenarioId] }, 'browser-replay-001')]);
      const replayed = await Promise.all(replayResponses.map(r => r.json() as Promise<Run>)); expect(replayed[0]!.id).toBe(replayed[1]!.id);
      expect((await waitFor(engine, replayed[0]!.id)).results[0]?.classification).toBe('confirmed');
      await unlink(join(engine.config.artifactDir, complete.id, screenshot.relativePath));
      expect((await fetch(url, { headers })).status).toBe(404);
      expect((await fetch(`${origin}/v1/runs/${complete.id}/report?format=markdown`, { headers })).status).toBe(200);
    } finally { await engine.close(); await removeTestDirectory(dir); }
  });

  it('keeps an unreachable owned target distinct from an application finding', async () => {
    const dir = await tempDirectory('offline-target'); const listener = createServer();
    await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve)); const address = listener.address(); if (!address || typeof address === 'string') throw new Error('No target port');
    await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const engine = await createEngine({ dataDir: dir, port: 0, token, logger: false }); const origin = await engine.listen();
    try {
      const scenario = ScenarioSchema.parse({ id: 'owned.offline', version: 1, title: 'Offline owned app', level: 1, category: 'functional', steps: [{ action: 'navigate', path: '/' }, { action: 'assert', assertionId: 'heading' }], expectedBehavior: 'Heading is present', assertions: [{ id: 'heading', kind: 'visible', selector: 'h1', description: 'A visible heading' }], safetyPermissions: ['navigation'], cleanup: 'close-context', evidenceRequirements: ['network'] });
      const response = await fetch(`${origin}/v1/runs`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ target: { kind: 'loopback', baseUrl, approvedOrigins: [baseUrl], acknowledgeOwnership: true }, levels: [1], scenarios: [scenario] }) }); expect(response.status).toBe(202);
      const run = await waitFor(engine, (await response.json() as Run).id); expect(run.state).toBe('partially_completed');
      expect(run.results[0]?.origin).toBe('infrastructure'); expect(run.results[0]?.classification).toBe('inconclusive'); expect(run.results[0]?.attempts[0]?.errorCode).toBe('TARGET_UNREACHABLE'); expect(run.results[0]?.severity).toBe('unassigned');
    } finally { await engine.close(); await removeTestDirectory(dir); }
  });

  it('does not claim completion when screenshot recording exceeds the evidence budget', async () => {
    const dir = await tempDirectory('capture-failure'); const engine = await createEngine({ dataDir: dir, port: 0, token, logger: false }); const origin = await engine.listen();
    try {
      const response = await fetch(`${origin}/v1/runs`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ target: { kind: 'fixture', variant: 'clean' }, levels: [1], recipeIds: ['normal.persistence'], budget: { maxArtifactBytes: 1024 } }) });
      const run = await waitFor(engine, (await response.json() as Run).id); expect(run.state).toBe('partially_completed'); expect(run.evidence).toEqual([]); expect(run.results[0]?.origin).toBe('infrastructure'); expect(run.results[0]?.attempts[0]?.errorCode).toBe('EVIDENCE_CAPTURE_FAILED'); expect(run.results[0]?.classification).toBe('inconclusive');
    } finally { await engine.close(); await removeTestDirectory(dir); }
  });
});
