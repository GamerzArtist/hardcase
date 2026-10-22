import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { RunStore } from '../../src/persistence/store.js';
import { CreateRunSchema } from '../../src/domain/models.js';
import { makeReport, markdownReport, compareRuns, ReportSchema } from '../../src/reporting/reports.js';
import { tempDirectory, removeTestDirectory } from '../helpers.js';
describe('durable state, queue, reporting', () => {
  it('maintains FIFO order, validates transitions, and preserves terminal state', async () => {
    const dir = await tempDirectory('store'); const store = new RunStore(join(dir, 'history.sqlite'));
    try {
      const a = store.create(CreateRunSchema.parse({ target: { kind: 'fixture' } })); const b = store.create(a.request);
      expect(store.queued().map(r => r.id)).toEqual([a.id, b.id]);
      expect(() => store.transition(a.id, 'completed')).toThrow('Invalid transition');
      store.transition(a.id, 'preparing'); store.transition(a.id, 'running'); store.transition(a.id, 'cancelled');
      expect(store.transition(a.id, 'failed').state).toBe('cancelled'); expect(store.transition(a.id, 'cancelled').state).toBe('cancelled');
      const history = store.history(a.id); expect(history.map(e => e.data.state)).toEqual(['queued', 'preparing', 'running', 'cancelled']);
      expect(store.history(a.id, history[1]!.id)).toHaveLength(2);
    } finally { store.close(); await removeTestDirectory(dir); }
  });
  it('recovers interrupted runs and preserves completed history across restart', async () => {
    const dir = await tempDirectory('restart'); const path = join(dir, 'history.sqlite'); let store = new RunStore(path);
    try {
      const done = store.create(CreateRunSchema.parse({ target: { kind: 'fixture' }, levels: [1, 2, 3, 4, 5], allowFixtureFaults: true }));
      for (const state of ['preparing', 'running', 'analyzing', 'completed'] as const) store.transition(done.id, state);
      const interrupted = store.create(done.request); store.transition(interrupted.id, 'preparing');
      store.close(); store = new RunStore(path); store.recover();
      expect(store.get(done.id)?.state).toBe('completed'); expect(store.get(interrupted.id)?.state).toBe('failed');
      const report = makeReport(store.get(done.id)!); expect(ReportSchema.safeParse(report).success).toBe(true);
      expect(markdownReport(report)).toContain('Passing does not establish'); expect(report.summary.unexecuted).toHaveLength(8);
      expect(compareRuns(store.get(done.id)!, store.get(interrupted.id)!).changes).toEqual([]);
      const changed = structuredClone(done); changed.request.budget.maxRequests = 9;
      expect(() => compareRuns(done, changed)).toThrow('incompatible');
    } finally { store.close(); await removeTestDirectory(dir); }
  });
});
