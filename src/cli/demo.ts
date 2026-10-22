import { resolve, join } from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { createEngine } from '../api/server.js';
import { isTerminal, type Run } from '../domain/models.js';

const dataDir = resolve(process.env.ENGINE_DATA_DIR ?? '.engine/demo');
let engine = await createEngine({ dataDir, port: 0, logger: false });
let origin = await engine.listen();
const api = async (path: string, body?: unknown): Promise<unknown> => {
  const response = await fetch(`${origin}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${engine.token}`, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}: ${await response.text()}`);
  return response.json();
};
const wait = async (id: string): Promise<Run> => {
  const deadline = Date.now() + 190000;
  while (Date.now() < deadline) { const run = await api(`/v1/runs/${id}`) as Run; if (isTerminal(run.state) && engine.manager.activeCount === 0) return run; await delay(100); }
  throw new Error('Demo wait exceeded maximum run deadline');
};
const verification: Record<string, unknown> = { at: new Date().toISOString(), aiEnabled: false };
try {
  let faulty!: Run; let clean!: Run;
  for (const variant of ['faulty', 'clean'] as const) {
    const created = await api('/v1/runs', { target: { kind: 'fixture', variant }, levels: [1, 2, 3, 4, 5], allowFixtureFaults: true, useAi: false }) as Run;
    const streamPromise = fetch(`${origin}/v1/runs/${created.id}/events`, { headers: { authorization: `Bearer ${engine.token}` } }).then(response => response.text());
    const completed = await wait(created.id); const events = await streamPromise;
    if (variant === 'faulty') faulty = completed; else clean = completed;
    verification[variant] = { id: completed.id, state: completed.state, scenarios: completed.results.map(r => ({ id: r.scenarioId, outcome: r.outcome, classification: r.classification, attempts: r.attempts.length })), evidenceCount: completed.evidence.length, actualNetworkRequests: completed.metrics.actualNetworkRequests, simulatedEvents: completed.metrics.simulatedEvents, progressEvents: (events.match(/\nevent:/g) ?? []).length, directory: join(engine.config.artifactDir, completed.id) };
    console.log(JSON.stringify({ variant, runId: completed.id, state: completed.state, results: completed.results.map(r => `${r.scenarioId}: ${r.classification}`), error: completed.error }));
    await writeFile(join(dataDir, `${variant}-events.sse`), events);
    if (completed.state !== 'completed') throw new Error(`${variant} fixture run did not complete`);
  }
  if (clean.results.some(result => result.classification !== 'passed')) throw new Error('Clean fixture failed an explicit assertion');
  if (!faulty.results.some(result => result.classification === 'confirmed')) throw new Error('Seeded defects were not reproduced');
  verification.comparison = await api('/v1/compare', { before: faulty.id, after: clean.id });
  const replay = await api(`/v1/runs/${faulty.id}/replay`, { scenarioIds: ['normal.persistence'] }) as Run;
  const replayed = await wait(replay.id); verification.replay = { id: replayed.id, state: replayed.state, reproduced: replayed.results[0]?.classification === 'confirmed' };
  const toCancel = await api('/v1/runs', { target: { kind: 'fixture', variant: 'clean' }, levels: [4], allowFixtureFaults: true }) as Run;
  while ((await api(`/v1/runs/${toCancel.id}`) as Run).state === 'queued') await delay(25);
  await api(`/v1/runs/${toCancel.id}/cancel`, {}); const cancelled = await wait(toCancel.id);
  verification.cancellation = { id: cancelled.id, state: cancelled.state, activeWorkers: engine.manager.activeCount };
  if (cancelled.state !== 'cancelled') throw new Error('Cancellation did not reach cancelled state');
  await engine.close();
  engine = await createEngine({ dataDir, port: 0, logger: false }); origin = await engine.listen();
  const persisted = await api(`/v1/runs/${faulty.id}`) as Run;
  const savedReport = JSON.parse(await readFile(join(engine.config.artifactDir, faulty.id, 'report.json'), 'utf8')) as { run: Run };
  verification.restart = { persisted: persisted.state === 'completed' && persisted.evidence.length === faulty.evidence.length, savedReportReadable: savedReport.run.id === faulty.id };
  if (!(verification.restart as { persisted: boolean }).persisted) throw new Error('History changed across restart');
  verification.passed = true;
} catch (error) { verification.passed = false; verification.error = String(error); process.exitCode = 1; }
finally {
  await engine.close(); await mkdir(dataDir, { recursive: true }); await writeFile(join(dataDir, 'verification.json'), JSON.stringify(verification, null, 2));
  console.log(`Verification: ${join(dataDir, 'verification.json')}`);
}
