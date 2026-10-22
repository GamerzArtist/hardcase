import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { isTerminal, type Run } from '../src/domain/models.js';
export type Engine = { store: { get(id: string): Run | undefined }; manager: { activeCount: number } };
export async function tempDirectory(prefix: string): Promise<string> { const root = resolve('.test-data'); await mkdir(root, { recursive: true }); return mkdtemp(join(root, `${prefix}-`)); }
export async function removeTestDirectory(directory: string): Promise<void> {
  const rel = relative(resolve('.test-data'), resolve(directory));
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Refusing cleanup outside test data');
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
export async function waitFor(engine: Engine, id: string, predicate: (run: Run) => boolean = run => isTerminal(run.state) && engine.manager.activeCount === 0, timeout = 160000): Promise<Run> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { const run = engine.store.get(id); if (run && predicate(run)) return run; if (run && isTerminal(run.state) && engine.manager.activeCount === 0) throw new Error(`Run ended before expected condition: ${run.state}; ${run.error ?? ''}`); await delay(25); }
  throw new Error(`Run ${id} failed to reach expected condition: ${engine.store.get(id)?.state}`);
}
export const token = 'test-only-local-session-token-at-least-32-characters';
