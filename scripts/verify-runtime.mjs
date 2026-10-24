import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const runtime = resolve(process.argv[2] ?? 'release/hardcase-runtime-checkpoint');
const dataDir = resolve(`.engine/package-smoke/${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(dataDir, { recursive: true });
const child = spawn(join(runtime, 'node.exe'), [join(runtime, 'scripts/desktop-engine.mjs')], { cwd: runtime, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ENGINE_DATA_DIR: dataDir, PLAYWRIGHT_BROWSERS_PATH: join(runtime, 'browsers'), PATH: join(process.env.SystemRoot, 'System32') } });
let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; });
const exit = new Promise((ok, fail) => { child.once('exit', code => ok(code)); child.once('error', fail); });
const lines = createInterface({ input: child.stdout });
const session = await Promise.race([new Promise(ok => lines.once('line', line => ok(JSON.parse(line)))), delay(20000).then(() => { throw new Error('Packaged engine startup timed out'); })]);
const request = async (path, body) => {
  const response = await fetch(session.origin + path, { method: body ? 'POST' : 'GET', headers: { authorization: `Bearer ${session.token}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal(response.ok, true, `${path}: HTTP ${response.status}`); return response.json();
};
let verification;
try {
  const ready = await request('/v1/ready'); assert.equal(ready.ok, true);
  const started = await request('/v1/runs', { target: { kind: 'fixture', variant: 'clean' }, levels: [1], recipeIds: ['normal.persistence'], useAi: false });
  let run; const deadline = Date.now() + 40000;
  do { await delay(200); run = await request(`/v1/runs/${started.id}`); } while (['queued', 'preparing', 'running', 'analyzing'].includes(run.state) && Date.now() < deadline);
  assert.equal(run.state, 'completed'); assert.equal(run.results[0].classification, 'passed');
  assert(run.evidence.some(item => item.kind === 'screenshot')); assert(run.evidence.some(item => item.kind === 'trace'));
  child.stdin.end('shutdown\n');
  const exitCode = await Promise.race([exit, delay(12000).then(() => { throw new Error('Packaged engine did not shut down'); })]);
  assert.equal(exitCode, 0);
  verification = { passed: true, runtime, dataDir, readiness: ready, nodeSource: 'bundled node.exe', browserSource: 'bundled browsers directory', pathLimitedTo: 'Windows System32', runId: run.id, state: run.state, classification: run.results[0].classification, browserVersion: run.environment.browserVersion, evidenceCount: run.evidence.length, shutdownExitCode: exitCode };
  console.log(JSON.stringify(verification, null, 2));
} finally {
  lines.close(); if (child.exitCode === null) { child.stdin.end(); await Promise.race([exit, delay(2000)]); if (child.exitCode === null) child.kill(); }
  await writeFile(join(dataDir, 'verification.json'), JSON.stringify(verification ?? { passed: false, stderr }, null, 2));
}
