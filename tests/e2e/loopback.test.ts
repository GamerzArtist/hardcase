import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createEngine, validateRunRequest } from '../../dist/api/server.js';
import { ScenarioSchema } from '../../src/domain/models.js';
import { startFixture } from '../../src/fixtures/app.js';
import { tempDirectory, removeTestDirectory, waitFor } from '../helpers.js';

describe('explicit user-owned loopback scenarios', () => {
  it('executes an allowlisted save/reload recipe without privileged fixture access or automatic replay', async () => {
    const dir = await tempDirectory('loopback'); const fixture = await startFixture({ directory: join(dir, 'app'), variant: 'clean' });
    const engine = await createEngine({ dataDir: join(dir, 'engine'), port: 0, logger: false }); await engine.listen();
    try {
      const scenario = ScenarioSchema.parse({ id: 'owned.save', version: 1, title: 'Owned note flow', level: 1, category: 'functional',
        prerequisites: ['Empty test notes'], steps: [{ action: 'navigate', path: '/' }, { action: 'fill', selector: '#note-title', value: 'Owned server note' }, { action: 'click', selector: '#save-note' }, { action: 'wait', ms: 750 }, { action: 'reload' }, { action: 'wait', ms: 500 }, { action: 'assert', assertionId: 'persisted' }],
        expectedBehavior: 'Exactly one note persists', assertions: [{ id: 'persisted', kind: 'count', selector: '#notes li', expected: 1, description: 'Saved note survives reload' }], safetyPermissions: ['navigation', 'form-interaction'], cleanup: 'close-context', evidenceRequirements: ['screenshot', 'network'], replayable: false,
      });
      const run = engine.manager.create(validateRunRequest({ target: { kind: 'loopback', baseUrl: fixture.baseUrl, approvedOrigins: [fixture.baseUrl], acknowledgeOwnership: true }, levels: [1], scenarios: [scenario] }, engine.manager.forbiddenPorts));
      const complete = await waitFor(engine, run.id);
      expect(complete.state).toBe('completed'); expect(complete.results[0]?.classification).toBe('passed'); expect(complete.results[0]?.replayable).toBe(false);
      expect(complete.results[0]?.attempts).toHaveLength(1); expect(complete.environment?.isolated).toBe(false); expect(complete.evidence.some(e => e.kind === 'trace')).toBe(false);
    } finally { await engine.close(); await fixture.close(); await removeTestDirectory(dir); }
  });
  it.each(['redirect', 'script-error', 'scenario-budget'] as const)('treats %s as an execution limitation, never a confirmed application defect', async mode => {
    const dir = await tempDirectory(mode); const fixture = await startFixture({ directory: join(dir, 'app'), variant: 'clean' });
    const engine = await createEngine({ dataDir: join(dir, 'engine'), port: 0, logger: false }); await engine.listen();
    try {
      const scenario = ScenarioSchema.parse({ id: `owned.${mode}`, version: 1, title: 'Blocked or invalid workflow', level: 1, category: 'functional',
        steps: [{ action: 'navigate', path: mode === 'redirect' ? '/redirect-external' : '/' }, ...(mode === 'script-error' ? [{ action: 'click', selector: '#does-not-exist' }] : [{ action: 'wait', ms: 500 }]), { action: 'assert', assertionId: 'heading' }],
        expectedBehavior: 'Visible heading', assertions: [{ id: 'heading', kind: 'visible', selector: 'h1', description: 'Heading is visible' }],
        safetyPermissions: ['navigation', 'form-interaction'], cleanup: 'close-context', evidenceRequirements: ['network'], ...(mode === 'scenario-budget' ? { budget: { maxRequests: 1 } } : {}),
      });
      const run = engine.manager.create(validateRunRequest({ target: { kind: 'loopback', baseUrl: fixture.baseUrl, approvedOrigins: [fixture.baseUrl], acknowledgeOwnership: true }, levels: [1], scenarios: [scenario] }));
      const complete = await waitFor(engine, run.id); expect(complete.results[0]?.classification).toBe('inconclusive'); expect(complete.results[0]?.severity).toBe('unassigned'); expect(complete.results[0]?.attempts).toHaveLength(1);
      if (mode === 'redirect') expect(complete.metrics.blockedRequests).toBeGreaterThan(0);
      if (mode === 'scenario-budget') { expect(complete.metrics.actualNetworkRequests).toBe(1); expect(complete.results[0]?.observedBehavior.toLowerCase()).toContain('budget'); }
    } finally { await engine.close(); await fixture.close(); await removeTestDirectory(dir); }
  });
  it('cancels during bounded load and closes the fixture listener', async () => {
    const dir = await tempDirectory('load-cancel'); const engine = await createEngine({ dataDir: dir, port: 0, logger: false }); await engine.listen();
    try {
      const run = engine.manager.create(validateRunRequest({ target: { kind: 'fixture', variant: 'clean' }, levels: [4], allowFixtureFaults: true }));
      const running = await waitFor(engine, run.id, r => r.state === 'running');
      const origin = running.environment!.targetOrigin!;
      // Observe the real disposable queue to cancel while a request is pending.
      let active = false;
      for (let i = 0; i < 20; i++) {
        const state = await fetch(`${origin}/api/state`).then(r => r.json()) as { queue: number };
        if (state.queue > 0) { active = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      expect(active).toBe(true); engine.manager.cancel(run.id);
      const cancelled = await waitFor(engine, run.id); expect(cancelled.state).toBe('cancelled');
      await expect(fetch(`${origin}/health`)).rejects.toThrow();
    } finally { await engine.close(); await removeTestDirectory(dir); }
  });
});
