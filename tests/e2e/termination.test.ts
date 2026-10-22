import { it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { readFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createEngine } from '../../dist/api/server.js';
import type { Run } from '../../src/domain/models.js';
import { tempDirectory, removeTestDirectory } from '../helpers.js';
import { killOwnedProcessTree, isProcessAlive } from '../../src/workers/processes.js';

it('cleans up after abrupt API process termination and repairs interrupted history on restart', async () => {
  const dir = await tempDirectory('parent-death');
  const child = spawn(process.execPath, [resolve('dist/cli/server.js')], { env: { ...process.env, ENGINE_DATA_DIR: dir, ENGINE_ARTIFACT_DIR: join(dir, 'artifacts'), ENGINE_PORT: '0', AI_ENABLED: 'false' }, stdio: 'ignore', windowsHide: true });
  let restarted: Awaited<ReturnType<typeof createEngine>> | undefined;
  try {
    let session: { token: string; origin: string } | undefined;
    for (let i = 0; i < 100; i++) {
      try { session = JSON.parse(await readFile(join(dir, 'session.json'), 'utf8')) as typeof session; break; } catch { await delay(50); }
    }
    if (!session) throw new Error('Child API did not start');
    const headers = { authorization: `Bearer ${session.token}`, 'content-type': 'application/json' };
    const created = await fetch(`${session.origin}/v1/runs`, { method: 'POST', headers, body: JSON.stringify({ target: { kind: 'fixture', variant: 'clean' }, levels: [1, 2], budget: { requestsPerSecond: 1 } }) }).then(r => r.json()) as Run;
    let running: Run | undefined;
    for (let i = 0; i < 150; i++) {
      const run = await fetch(`${session.origin}/v1/runs/${created.id}`, { headers }).then(r => r.json()) as Run;
      if (run.state === 'running') { running = run; break; }
      await delay(50);
    }
    expect(running?.state).toBe('running');
    process.kill(child.pid!, 'SIGKILL');
    const fixtureOrigin = running!.environment!.targetOrigin!;
    let fixtureClosed = false;
    for (let i = 0; i < 100; i++) { try { await fetch(`${fixtureOrigin}/health`, { signal: AbortSignal.timeout(200) }); } catch { fixtureClosed = true; break; } await delay(50); }
    expect(fixtureClosed).toBe(true);
    restarted = await createEngine({ dataDir: dir, port: 0, logger: false }); await restarted.listen();
    // A hard OS kill can prevent all finally blocks. Startup reconciles any disk leftovers.
    await expect(access(join(dir, 'artifacts', created.id, 'disposable-fixture'))).rejects.toThrow();
    expect(restarted.store.get(created.id)?.state).toBe('failed'); expect(restarted.store.get(created.id)?.error).toContain('restarted');
  } finally {
    if (child.pid && isProcessAlive(child.pid)) await killOwnedProcessTree(child.pid, false);
    await restarted?.close(); await removeTestDirectory(dir);
  }
});
