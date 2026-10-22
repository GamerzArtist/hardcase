import { describe, it, expect } from 'vitest';
import { BudgetSchema, ScenarioSchema } from '../../src/domain/models.js';
import { assertAllowedUrl, canonicalUrl, validateScenario, validateTarget } from '../../src/security/targets.js';
import { BudgetGuard } from '../../src/security/budget.js';
import { SafeHttp } from '../../src/security/http.js';
import { emptyMetrics } from '../../src/domain/models.js';
import { redact } from '../../src/security/redact.js';
import { startFixture } from '../../src/fixtures/app.js';
import { removeTestDirectory, tempDirectory } from '../helpers.js';
import { validateRunRequest } from '../../src/api/server.js';

describe('target and scenario safety', () => {
  it.each(['https://example.com', 'http://192.168.1.5:8080', 'http://169.254.169.254:8080', 'http://0.0.0.0:8080', 'http://127.1:8080', 'http://2130706433:8080', 'http://0x7f000001:8080', 'http://127.0.0.1.nip.io:8080', 'http://user:pass@127.0.0.1:8080', 'http://127.0.0.1:22', 'file:///C:/Windows', 'http://127.0.0.1:8080\\@evil.com', 'http://localhost.:8080', 'http://[::ffff:127.0.0.1]:8080'])('rejects unsafe or ambiguous target %s', value => { expect(() => canonicalUrl(value)).toThrow(); });
  it('pins localhost and requires an explicit origin, including port', () => {
    expect(validateTarget({ kind: 'loopback', baseUrl: 'http://localhost:8080/', approvedOrigins: ['http://localhost:8080'], acknowledgeOwnership: true })).toMatchObject({ baseUrl: 'http://127.0.0.1:8080/', approvedOrigins: ['http://127.0.0.1:8080'] });
    expect(() => assertAllowedUrl('http://127.0.0.1:8081/', ['http://127.0.0.1:8080'])).toThrow();
    expect(() => canonicalUrl('http://127.0.0.1:4318', [4318])).toThrow();
  });
  it('blocks public redirects before following them', async () => {
    const directory = await tempDirectory('redirect'); const fixture = await startFixture({ directory, variant: 'clean' });
    try {
      const metrics = emptyMetrics(); const guard = new BudgetGuard(BudgetSchema.parse({}), new AbortController().signal);
      const http = new SafeHttp([fixture.baseUrl], guard, metrics, []);
      await expect(http.request(`${fixture.baseUrl}/redirect-external`)).rejects.toThrow();
      expect(metrics.actualNetworkRequests).toBe(1);
    } finally { await fixture.close(); await removeTestDirectory(directory); }
  });
  it('rejects arbitrary actions and broken assertion references', () => {
    const definition = { id: 'custom', version: 1, title: 'Custom', level: 1, category: 'smoke', steps: [{ action: 'assert', assertionId: 'missing' }], expectedBehavior: 'Visible heading', assertions: [{ id: 'heading', kind: 'visible', selector: 'h1', description: 'Heading exists' }], safetyPermissions: ['navigation'], cleanup: 'close-context', evidenceRequirements: ['screenshot'] };
    const scenario = ScenarioSchema.parse(definition); expect(() => validateScenario(scenario)).toThrow('Unknown assertion');
    expect(() => ScenarioSchema.parse({ ...definition, steps: [{ action: 'evaluate', code: 'process.exit()' }] })).toThrow();
    expect(() => ScenarioSchema.parse({ ...definition, steps: [{ action: 'navigate', path: '//example.com' }] })).toThrow();
    expect(() => validateRunRequest({ target: { kind: 'loopback', baseUrl: 'http://127.0.0.1:8080', approvedOrigins: ['http://127.0.0.1:8080'], acknowledgeOwnership: true }, levels: [3] })).toThrow('disposable');
  });
  it('redacts nested credentials and bearer strings', () => {
    expect(redact({ authorization: 'Bearer abc', nested: { apiKey: 'shh', message: 'Bearer a.b.c' }, url: '/?token=supersecret' })).toEqual({ authorization: '[REDACTED]', nested: { apiKey: '[REDACTED]', message: 'Bearer [REDACTED]' }, url: '/?token=[REDACTED]' });
  });
});
describe('bounded execution', () => {
  it('never exceeds the concurrent network cap even when callers arrive together', async () => {
    const guard = new BudgetGuard(BudgetSchema.parse({ maxConcurrency: 2, requestsPerSecond: 20 }), new AbortController().signal);
    let active = 0; let peak = 0;
    await Promise.all(Array.from({ length: 5 }, async () => { const release = await guard.acquire(); active++; peak = Math.max(peak, active); await new Promise(resolve => setTimeout(resolve, 120)); active--; release(); }));
    expect(peak).toBe(2);
  });
  it('enforces count across concurrent reservations and spaces request slots', async () => {
    const guard = new BudgetGuard(BudgetSchema.parse({ maxRequests: 3, requestsPerSecond: 20 }), new AbortController().signal);
    const started = performance.now(); const result = await Promise.allSettled([guard.request(), guard.request(), guard.request(), guard.request()]);
    expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(3); expect(guard.requests).toBe(3); expect(performance.now() - started).toBeGreaterThanOrEqual(85);
  });
  it('cancels waiting rate-limit reservations', async () => {
    const controller = new AbortController(); const guard = new BudgetGuard(BudgetSchema.parse({ requestsPerSecond: 1 }), controller.signal);
    await guard.request(); const pending = guard.request(); controller.abort(); await expect(pending).rejects.toThrow();
  });
  it('rejects resource cap escalation and duplicate IDs', () => {
    expect(() => BudgetSchema.parse({ maxConcurrency: 500 })).toThrow();
    expect(() => validateRunRequest({ target: { kind: 'fixture' }, levels: [1, 1] })).toThrow();
    expect(() => validateRunRequest({ target: { kind: 'fixture' }, recipeIds: ['unknown'] })).toThrow();
    expect(() => validateRunRequest({ target: { kind: 'fixture' }, levels: [3, 4, 5] })).toThrow('allowFixtureFaults');
    expect(validateRunRequest({ target: { kind: 'fixture' } }).levels).toEqual([1, 2]);
  });
});
