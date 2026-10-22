import { describe, it, expect } from 'vitest';
import { analyzeRun } from '../../src/ai/provider.js';
describe('optional AI gateway', () => {
  it('makes no provider calls when disabled', async () => {
    let calls = 0; const result = await analyzeRun({ results: [] }, { enabled: false, fetcher: async () => { calls++; throw new Error('Must not be called'); } });
    expect(result.status).toBe('disabled'); expect(calls).toBe(0);
  });
  it('requires explicit endpoint and model', async () => { expect((await analyzeRun({ results: [] }, { enabled: true, endpoint: '', model: '' })).status).toBe('unavailable'); });
  it('accepts a bounded explanation without changing execution results', async () => {
    let body = '';
    const result = await analyzeRun({ goals: 'Test notes', results: [] }, { enabled: true, endpoint: 'https://gateway.example/v1/analyze', model: 'configured-by-user', fetcher: async (_input, init) => { body = String(init?.body); return Response.json({ explanation: 'Evidence is limited', suggestions: ['Replay'], proposedScenarios: [] }); } });
    expect(result.status).toBe('completed'); expect(result.requests).toBe(1); expect(body).toContain('maxOutputTokens');
  });
  it.each(['http-error', 'invalid-json', 'unsafe-plan', 'oversized', 'timeout'])('fails safely for %s without retries', async mode => {
    let calls = 0;
    const result = await analyzeRun({ results: [] }, { enabled: true, endpoint: 'https://gateway.example/analyze', model: 'configured', timeoutMs: 100, fetcher: async (_input, init) => {
      calls++;
      if (mode === 'http-error') return new Response('Unavailable', { status: 503 });
      if (mode === 'invalid-json') return new Response('not json');
      if (mode === 'unsafe-plan') return Response.json({ explanation: 'run code', suggestions: [], proposedScenarios: [{ steps: [{ action: 'shell', command: 'danger' }] }] });
      if (mode === 'oversized') return new Response('x'.repeat(65000));
      return new Promise((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(new Error('Timed out')), { once: true }); });
    } });
    expect(result.status).toBe('failed'); expect(calls).toBe(1); expect(result.proposedScenarios).toHaveLength(0);
  });
});
