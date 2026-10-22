import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { ENGINE_VERSION, TRANSITIONS, emptyMetrics, isTerminal, type CreateRun, type Run, type RunEvent, type RunState } from '../domain/models.js';
import { disabledAi } from '../ai/provider.js';
import { RECIPES } from '../strategies/catalog.js';

export class RunStore {
  readonly events = new EventEmitter();
  private readonly db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS runs(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,state TEXT NOT NULL,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,run_id TEXT NOT NULL,data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS events_by_run ON events(run_id,id);
      PRAGMA user_version=1;`);
    this.events.setMaxListeners(50);
    // Additive snapshot migration preserves previously observed results from pre-handoff local runs.
    const legacyRows = this.db.prepare('SELECT id,data FROM runs').all() as Array<{ id: string; data: string }>;
    for (const row of legacyRows) {
      const run = JSON.parse(row.data) as Run;
      if (run.progress && run.results.every(result => result.id)) continue;
      run.request.allowFixtureFaults ??= false;
      run.progress = progressFor(run.request, run.results.length);
      for (const result of run.results) {
        result.id ??= randomUUID(); result.runId ??= run.id; result.firstObservedAt ??= result.attempts[0]?.startedAt ?? run.createdAt;
        result.severityRationale ??= 'Legacy fixture result; severity was assigned from the declared fixture invariant. Consult original assertions for impact.';
        result.reproductionSteps ??= result.attempts[0]?.actions.map(action => action.action) ?? [];
        result.verification ??= { retested: result.attempts.length > 1, reproduced: result.classification === 'confirmed', matchingAssertionIds: result.attempts[0]?.assertions.filter(a => !a.passed && result.attempts[1]?.assertions.some(b => b.id === a.id && !b.passed)).map(a => a.id) ?? [] };
      }
      this.db.prepare('UPDATE runs SET data=? WHERE id=?').run(JSON.stringify(run), run.id);
    }
  }
  create(request: CreateRun, replayOf: string | null = null): Run {
    const now = new Date().toISOString();
    const run: Run = { id: randomUUID(), state: 'queued', createdAt: now, updatedAt: now, startedAt: null, finishedAt: null,
      request, results: [], evidence: [], metrics: emptyMetrics(), environment: { engineVersion: ENGINE_VERSION, nodeVersion: process.version, platform: process.platform, targetKind: request.target.kind, isolated: request.target.kind === 'fixture' },
      error: null, replayOf, ai: disabledAi(), revision: 0, progress: progressFor(request, 0) };
    this.db.exec('BEGIN IMMEDIATE');
    let event: RunEvent;
    try {
      this.db.prepare('INSERT INTO runs(id,state,data) VALUES (?,?,?)').run(run.id, run.state, JSON.stringify(run));
      event = this.insertEvent(run.id, 'state', { state: 'queued' }); this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    this.publish(event!); return run;
  }
  get(id: string): Run | undefined {
    const row = this.db.prepare('SELECT data FROM runs WHERE id=?').get(id) as { data: string } | undefined;
    return row ? JSON.parse(row.data) as Run : undefined;
  }
  list(limit = 100, offset = 0): Run[] {
    const rows = this.db.prepare('SELECT data FROM runs ORDER BY seq DESC LIMIT ? OFFSET ?').all(limit, offset) as Array<{ data: string }>;
    return rows.map(row => JSON.parse(row.data) as Run);
  }
  queued(): Run[] {
    return (this.db.prepare('SELECT data FROM runs WHERE state=? ORDER BY seq').all('queued') as Array<{ data: string }>).map(row => JSON.parse(row.data) as Run);
  }
  active(): Run[] {
    return (this.db.prepare("SELECT data FROM runs WHERE state IN ('preparing','running','analyzing') ORDER BY seq").all() as Array<{ data: string }>).map(row => JSON.parse(row.data) as Run);
  }
  mutate(id: string, mutation: (run: Run) => void, type: RunEvent['type'], data: RunEvent['data']): Run {
    this.db.exec('BEGIN IMMEDIATE'); let event: RunEvent; let run: Run;
    try {
      const current = this.get(id); if (!current) throw new Error('Run not found');
      run = current; mutation(run); run.updatedAt = new Date().toISOString(); run.revision++;
      this.db.prepare('UPDATE runs SET state=?,data=? WHERE id=?').run(run.state, JSON.stringify(run), id);
      event = this.insertEvent(id, type, data); this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    this.publish(event!); return run!;
  }
  transition(id: string, state: RunState, error: string | null = null): Run {
    const current = this.get(id); if (!current) throw new Error('Run not found');
    if (current.state === state || isTerminal(current.state)) return current;
    return this.mutate(id, run => {
      if (!TRANSITIONS[run.state].includes(state)) throw new Error(`Invalid transition ${run.state} -> ${state}`);
      run.state = state; run.error = error;
      if (state === 'preparing') run.startedAt = new Date().toISOString();
      if (isTerminal(state)) run.finishedAt = new Date().toISOString();
      if (isTerminal(state)) run.progress.currentScenarioId = null;
    }, 'state', { state, ...(error ? { reason: error } : {}) });
  }
  appendEvent(id: string, type: RunEvent['type'], data: RunEvent['data']): void { const event = this.insertEvent(id, type, data); this.publish(event); }
  history(id: string, after = 0, limit = 1000): RunEvent[] {
    const rows = this.db.prepare('SELECT id,data FROM events WHERE run_id=? AND id>? ORDER BY id LIMIT ?').all(id, after, limit) as Array<{ id: number; data: string }>;
    return rows.map(row => ({ ...JSON.parse(row.data) as RunEvent, id: row.id }));
  }
  recover(): void {
    for (const run of this.active()) this.transition(run.id, 'failed', 'Backend restarted while run was active; partial evidence is retained.');
  }
  close(): void { this.events.removeAllListeners(); this.db.close(); }
  private insertEvent(runId: string, type: RunEvent['type'], data: RunEvent['data']): RunEvent {
    const event: RunEvent = { id: 0, runId, at: new Date().toISOString(), type, data };
    const result = this.db.prepare('INSERT INTO events(run_id,data) VALUES (?,?)').run(runId, JSON.stringify(event));
    event.id = Number(result.lastInsertRowid); return event;
  }
  private publish(event: RunEvent): void { this.events.emit(event.runId, event); }
}
function progressFor(request: CreateRun, completedScenarios: number): Run['progress'] {
  const totalScenarios = (request.target.kind === 'fixture' ? RECIPES.filter(recipe => request.levels.includes(recipe.level) && (!request.recipeIds || request.recipeIds.includes(recipe.id))).length : 0) + request.scenarios.length;
  return { totalScenarios, completedScenarios, currentScenarioId: null, percent: totalScenarios ? Math.min(100, Math.floor(100 * completedScenarios / totalScenarios)) : 0 };
}
