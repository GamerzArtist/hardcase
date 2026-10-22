import { it, expect } from 'vitest';
import { startFixture } from '../../src/fixtures/app.js';
import { tempDirectory, removeTestDirectory } from '../helpers.js';
it.each(['clean', 'faulty'] as const)('independently verifies %s fixture authorization and cost counter behavior', async variant => {
  const dir = await tempDirectory(`fixture-${variant}`); const fixture = await startFixture({ variant, directory: dir });
  try {
    const denied = await fixture.app.inject({ method: 'POST', url: '/api/admin/reset', headers: { 'x-test-role': 'viewer' }, payload: {} });
    expect(denied.statusCode).toBe(variant === 'clean' ? 403 : 200);
    for (const operationId of ['one', 'one', 'two']) await fixture.app.inject({ method: 'POST', url: '/api/ai', payload: { operationId, tokens: 60 } });
    const state = (await fixture.app.inject('/api/state')).json<{ spent: number; costCalls: number }>();
    expect(state.spent).toBe(variant === 'clean' ? 60 : 180);
    fixture.setFaults({ failWrite: true }); await fixture.app.inject({ method: 'POST', url: '/api/transfer', payload: { amount: 10, operationId: 'write' } });
    expect((await fixture.app.inject('/api/state')).json<{ balance: number }>().balance).toBe(variant === 'clean' ? 100 : 90);
    await fixture.reset(); expect((await fixture.app.inject('/api/state')).json<{ spent: number }>().spent).toBe(0);
  } finally { await fixture.close(); await removeTestDirectory(dir); }
});
