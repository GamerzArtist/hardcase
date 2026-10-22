import { mkdir, writeFile, stat, readFile, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { Evidence, WorkerEmit } from '../domain/models.js';
import { BudgetError } from '../security/budget.js';
import { redact } from '../security/redact.js';

export class EvidenceStore {
  private used = 0;
  constructor(readonly runId: string, readonly directory: string, readonly maxBytes: number, readonly emit: WorkerEmit) {}
  async save(scenarioId: string, attempt: number, kind: Evidence['kind'], data: Buffer | unknown): Promise<Evidence> {
    const id = randomUUID();
    const extension = kind === 'screenshot' ? 'png' : kind === 'trace' ? 'zip' : 'json';
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(redact(data), null, 2));
    if (this.used + buffer.length > this.maxBytes) throw new BudgetError('Evidence byte budget exhausted');
    const relativePath = `${id}.${extension}`;
    await mkdir(this.directory, { recursive: true });
    await writeFile(join(this.directory, relativePath), buffer, { flag: 'wx', mode: 0o600 });
    this.used += buffer.length;
    const evidence: Evidence = { id, runId: this.runId, scenarioId, attempt, kind, relativePath,
      mediaType: extension === 'png' ? 'image/png' : extension === 'zip' ? 'application/zip' : 'application/json',
      bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex'),
      sensitive: kind === 'trace' || kind === 'screenshot', createdAt: new Date().toISOString(),
    };
    this.emit({ type: 'evidence', evidence }); return evidence;
  }
  async adoptTrace(scenarioId: string, attempt: number, temporaryPath: string): Promise<Evidence> {
    try {
      const info = await stat(temporaryPath);
      if (this.used + info.size > this.maxBytes) throw new BudgetError('Trace exceeds evidence budget');
      return await this.save(scenarioId, attempt, 'trace', await readFile(temporaryPath));
    } finally { await unlink(temporaryPath).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }); }
  }
}
