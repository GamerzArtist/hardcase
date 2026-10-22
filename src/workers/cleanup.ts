import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
export async function cleanupDisposable(directory: string): Promise<void> {
  // Caller supplies an engine-generated run directory, never a path from a scenario.
  await rm(join(directory, 'disposable-fixture'), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  let entries: string[];
  try { entries = await readdir(directory); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  for (const name of entries) if (/^\.trace-[a-f0-9-]+\.zip$/.test(name)) await rm(join(directory, name), { force: true });
}
