import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { createEngine } from '../../src/api/server.js';
import { CreateRunSchema, type Run, type RunEvent } from '../../src/domain/models.js';
import { EventPageSchema, ReadinessSchema } from '../../src/api/contracts.js';
import { tempDirectory, removeTestDirectory, token, waitFor } from '../helpers.js';

describe('release API recovery and idempotency', () => {
  it('deduplicates simultaneous starts, rejects conflicting reuse, and keeps keys across restart', async () => {
    const dir = await tempDirectory('idempotent');
    const config = { dataDir: dir, port: 0, token, logger: false, allowedOrigins: ['http://127.0.0.1:4327'] };
    const internal = { workerPath: resolve('tests/support/controlled-worker.mjs') };
    let engine = await createEngine(config, internal); let origin = await engine.listen();
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': 'release-start-001', origin: 'http://127.0.0.1:4327' };
    const body = { target: { kind: 'fixture' }, goals: 'complete' };
    const start = (input: unknown = body, key = headers['idempotency-key']) => fetch(`${origin}/v1/runs`, { method: 'POST', headers: { ...headers, 'idempotency-key': key }, body: JSON.stringify(input) });
    try {
      const responses = await Promise.all(Array.from({ length: 8 }, () => start()));
      expect(responses.every(r => r.status === 202)).toBe(true);
      expect(responses.filter(r => r.headers.get('idempotency-replayed') === 'false')).toHaveLength(1);
      expect(responses[0]!.headers.get('access-control-expose-headers')).toContain('Idempotency-Replayed');
      const runs = await Promise.all(responses.map(r => r.json() as Promise<Run>)); const id = runs[0]!.id;
      expect(new Set(runs.map(r => r.id)).size).toBe(1); expect(engine.store.list()).toHaveLength(1);
      const normalizedRetry = await start(CreateRunSchema.parse(body)); expect((await normalizedRetry.json() as Run).id).toBe(id);
      const conflict = await start({ ...body, levels: [1] }); expect(conflict.status).toBe(409); expect((await conflict.json() as { error: string }).error).toBe('IDEMPOTENCY_CONFLICT');
      expect((await start(body, 'short')).status).toBe(400);
      expect((await start(body, 'bad key value')).status).toBe(400);
      for (const baseUrl of ['https://example.com', 'http://169.254.169.254:8080/latest/meta-data/', 'http://127.0.0.1.nip.io:8080', 'http://2130706433:8080', 'http://user:pass@127.0.0.1:8080', 'http://127.0.0.1:8080\\@evil.example', 'http://192.168.1.2:8080', 'http://localhost.:8080']) {
        const rejected = await fetch(`${origin}/v1/targets/validate`, { method: 'POST', headers, body: JSON.stringify({ kind: 'loopback', baseUrl, approvedOrigins: [baseUrl], acknowledgeOwnership: true }) });
        expect(rejected.status, baseUrl).toBe(400);
      }
      const preflight = await fetch(`${origin}/v1/runs`, { method: 'OPTIONS', headers: { origin: headers.origin, 'access-control-request-headers': 'Idempotency-Key,Authorization' } });
      expect(preflight.headers.get('access-control-allow-headers')).toContain('Idempotency-Key');
      await waitFor(engine, id); await engine.close();
      engine = await createEngine(config, internal); origin = await engine.listen();
      const retry = await start(); expect(retry.headers.get('idempotency-replayed')).toBe('true'); expect((await retry.json() as Run).id).toBe(id);
      expect(engine.store.list()).toHaveLength(1); expect(engine.manager.activeCount).toBe(0);
      expect(engine.store.history(id).filter(e => e.data.state === 'queued')).toHaveLength(1);
    } finally { await engine.close(); await removeTestDirectory(dir); }
  });

  it('returns all durable events through bounded cursor pages without duplicates or lost terminal state', async () => {
    const dir = await tempDirectory('event-pages'); const engine = await createEngine({ dataDir: dir, port: 0, token, logger: false }); const origin = await engine.listen();
    const headers = { authorization: `Bearer ${token}` };
    try {
      const run = engine.store.create(CreateRunSchema.parse({ target: { kind: 'fixture' } }));
      for (let index = 0; index < 1100; index++) engine.store.appendEvent(run.id, 'progress', { index });
      engine.store.transition(run.id, 'cancelled', 'Cancelled before execution');
      let after = 0; const events: RunEvent[] = [];
      for (;;) {
        const page = EventPageSchema.parse(await fetch(`${origin}/v1/runs/${run.id}/events/poll?after=${after}&limit=137`, { headers }).then(r => r.json()));
        expect(page.events.length).toBeLessThanOrEqual(137); expect(page.terminal).toBe(true);
        expect(page.events.every(e => e.id > after && e.runId === run.id)).toBe(true);
        events.push(...page.events); after = page.nextCursor;
        if (!page.hasMore) break;
      }
      expect(events).toHaveLength(1102); expect(new Set(events.map(e => e.id)).size).toBe(1102); expect(events.at(-1)?.data.state).toBe('cancelled');
      const empty = EventPageSchema.parse(await fetch(`${origin}/v1/runs/${run.id}/events/poll?after=${after}`, { headers }).then(r => r.json()));
      expect(empty.events).toEqual([]); expect(empty.nextCursor).toBe(after); expect(empty.hasMore).toBe(false);
      expect((await fetch(`${origin}/v1/runs/${run.id}/events/poll?limit=201`, { headers })).status).toBe(400);
      expect((await fetch(`${origin}/v1/runs/${run.id}/events/poll?after=-1`, { headers })).status).toBe(400);
      expect((await fetch(`${origin}/v1/runs/${run.id}/events/poll`)).status).toBe(401);
      const stream = await fetch(`${origin}/v1/runs/${run.id}/events?after=${events[1099]!.id}`, { headers }).then(r => r.text());
      expect(stream).toContain('"state":"cancelled"');
    } finally { await engine.close(); await removeTestDirectory(dir); }
  });

  it('reports a missing compiled worker as dependency failure while liveness stays available', async () => {
    const dir = await tempDirectory('readiness-worker'); const engine = await createEngine({ dataDir: dir, port: 0, token, logger: false }, { workerPath: resolve(dir, 'missing-worker.js') }); const origin = await engine.listen();
    try {
      expect((await fetch(`${origin}/v1/ready`)).status).toBe(401);
      const response = await fetch(`${origin}/v1/ready`, { headers: { authorization: `Bearer ${token}` } }); expect(response.status).toBe(503);
      const ready = ReadinessSchema.parse(await response.json()); expect(ready.ok).toBe(false); expect(ready.checks.storage).toBe(true); expect(ready.checks.worker).toBe(false); expect(ready.issues.map(i => i.code)).toContain('WORKER_UNAVAILABLE');
      expect((await fetch(`${origin}/v1/health`)).status).toBe(200);
    } finally { await engine.close(); await removeTestDirectory(dir); }
  });
});
