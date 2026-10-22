import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import type { EngineConfig } from '../config.js';
import { isTerminal, type CreateRun, type Run, type RunState, type WorkerMessage } from '../domain/models.js';
import { RunStore } from '../persistence/store.js';
import { analyzeRun } from '../ai/provider.js';
import { comparisonKey, saveReports } from '../reporting/reports.js';
import { killOwnedProcessTree } from '../workers/processes.js';
import { redactText } from '../security/redact.js';
import { cleanupDisposable } from '../workers/cleanup.js';

interface Job {
  child: ChildProcess; browserPid?: number; heartbeatAt: number; startedAt: number;
  stopState?: RunState; reason?: string; done?: boolean; partial?: boolean; error?: string;
  forceTimer?: ReturnType<typeof setTimeout>; finalizing: boolean;
  closed: Promise<void>; resolveClosed(): void;
}
export class RunManager {
  private readonly jobs = new Map<string, Job>();
  private readonly monitor: ReturnType<typeof setInterval>;
  private closing = false;
  private scheduling = false;
  forbiddenPorts: number[] = [];
  readonly failures: string[] = [];
  constructor(readonly store: RunStore, readonly config: EngineConfig, private readonly workerPath = fileURLToPath(new URL('../workers/entry.js', import.meta.url))) {
    this.monitor = setInterval(() => this.tick(), 250); this.monitor.unref();
  }
  create(request: CreateRun, replayOf: string | null = null): Run {
    if (this.closing) throw new Error('Engine is shutting down');
    if (this.store.queued().length >= this.config.maxQueuedJobs) throw new Error('Run queue is full');
    const run = this.store.create(request, replayOf); this.schedule(); return run;
  }
  get activeCount(): number { return this.jobs.size; }
  processIds(id: string): { worker?: number; browser?: number } { const job = this.jobs.get(id); return { worker: job?.child.pid, browser: job?.browserPid }; }
  start(): void { this.store.recover(); this.schedule(); }
  cancel(id: string): Run {
    const run = this.store.get(id); if (!run) throw new Error('Run not found');
    if (isTerminal(run.state)) return run;
    if (run.state === 'queued') {
      const cancelled = this.store.transition(id, 'cancelled', 'Cancelled before execution');
      void saveReports(cancelled, join(this.config.artifactDir, id)).catch(error => this.failures.push(String(error))); return cancelled;
    }
    this.stop(id, 'cancelled', 'Cancelled by local user'); return this.store.get(id)!;
  }
  private schedule(): void {
    if (this.scheduling || this.closing) return;
    this.scheduling = true;
    queueMicrotask(() => {
      this.scheduling = false;
      if (this.closing) return;
      for (const run of this.store.queued()) {
        if (this.jobs.size >= this.config.maxConcurrentJobs) break;
        this.launch(run);
      }
    });
  }
  private launch(run: Run): void {
    this.store.transition(run.id, 'preparing');
    const safeEnv: NodeJS.ProcessEnv = {};
    for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'LOCALAPPDATA', 'TEMP', 'TMP', 'USERPROFILE', 'HOME', 'PLAYWRIGHT_BROWSERS_PATH']) if (process.env[key]) safeEnv[key] = process.env[key];
    const child = fork(this.workerPath, [], { execArgv: ['--max-old-space-size=256'], stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: safeEnv, ...{ windowsHide: true }, detached: process.platform !== 'win32' });
    let resolveClosed!: () => void;
    const closed = new Promise<void>(resolve => { resolveClosed = resolve; });
    const job: Job = { child, heartbeatAt: Date.now(), startedAt: Date.now(), finalizing: false, closed, resolveClosed };
    this.jobs.set(run.id, job);
    child.stderr?.on('data', (buffer: Buffer) => { const message = redactText(buffer.toString()); if (!message.includes('ExperimentalWarning') && !message.includes('trace-warnings')) job.error = message; });
    child.on('message', message => this.onMessage(run.id, message as WorkerMessage));
    child.once('error', error => { job.error = redactText(error.message); void this.finish(run.id, 1); });
    child.once('exit', code => { void this.finish(run.id, code); });
    child.send({ type: 'start', input: { runId: run.id, request: run.request, artifactDir: join(this.config.artifactDir, run.id), forbiddenPorts: this.forbiddenPorts } });
  }
  private onMessage(id: string, message: WorkerMessage): void {
    const job = this.jobs.get(id); const run = this.store.get(id);
    if (!job || !run || job.finalizing || isTerminal(run.state)) return;
    if (message.type === 'heartbeat') { job.heartbeatAt = Date.now(); return; }
    if (message.type === 'browser') { if (Number.isSafeInteger(message.pid) && message.pid > 0) job.browserPid = message.pid; return; }
    if (job.stopState) return;
    switch (message.type) {
      case 'ready':
        this.store.mutate(id, r => { r.environment = message.environment; }, 'progress', { message: 'Execution environment ready' });
        this.store.transition(id, 'running'); break;
      case 'progress': this.store.mutate(id, r => { r.progress.currentScenarioId = message.scenarioId ?? r.progress.currentScenarioId; }, 'progress', { message: message.message, scenarioId: message.scenarioId }); break;
      case 'evidence': this.store.mutate(id, r => { r.evidence.push(message.evidence); }, 'evidence', { artifactId: message.evidence.id, kind: message.evidence.kind }); break;
      case 'result': this.store.mutate(id, r => { r.results.push(message.result); r.progress.completedScenarios = r.results.length; r.progress.currentScenarioId = null; r.progress.percent = r.progress.totalScenarios ? Math.min(100, Math.floor(100 * r.results.length / r.progress.totalScenarios)) : 0; }, 'scenario', { scenarioId: message.result.scenarioId, level: message.result.level, outcome: message.result.outcome, classification: message.result.classification }); break;
      case 'metrics': this.store.mutate(id, r => { r.metrics = message.metrics; }, 'progress', { actualNetworkRequests: message.metrics.actualNetworkRequests, simulatedEvents: message.metrics.simulatedEvents }); break;
      case 'done': job.done = true; job.partial = message.partial; this.store.transition(id, 'analyzing'); break;
      case 'error': job.error = message.message; break;
    }
  }
  private tick(): void {
    for (const [id, job] of this.jobs) {
      if (job.stopState || job.finalizing) continue;
      const run = this.store.get(id)!;
      if (Date.now() - job.startedAt > run.request.budget.maxDurationMs) this.stop(id, 'timed_out', 'Execution deadline exceeded');
      else if (Date.now() - job.heartbeatAt > this.config.heartbeatTimeoutMs) this.stop(id, 'failed', 'Worker heartbeat was lost');
    }
  }
  private stop(id: string, state: RunState, reason: string): void {
    const job = this.jobs.get(id); if (!job || job.stopState) return;
    job.stopState = state; job.reason = reason;
    this.store.appendEvent(id, 'progress', { message: 'Stopping worker and cleaning up resources', requestedState: state });
    if (job.child.connected) job.child.send({ type: 'cancel' });
    job.forceTimer = setTimeout(() => { void killOwnedProcessTree(job.child.pid, true).catch(error => { job.error = `Worker cleanup failed: ${String(error)}`; this.failures.push(job.error); }); }, this.config.cancellationGraceMs);
    job.forceTimer.unref();
  }
  private async finish(id: string, exitCode: number | null): Promise<void> {
    const job = this.jobs.get(id); if (!job || job.finalizing) return;
    job.finalizing = true; if (job.forceTimer) clearTimeout(job.forceTimer);
    try {
      await killOwnedProcessTree(job.browserPid);
      const directory = join(this.config.artifactDir, id);
      await mkdir(directory, { recursive: true });
      await cleanupDisposable(directory);
      const current = this.store.get(id)!;
      let terminal: RunState = job.stopState ?? (job.done && exitCode === 0 ? job.partial ? 'partially_completed' : 'completed' : 'failed');
      if (job.done && !job.stopState && current.request.useAi) {
        const ai = await analyzeRun({ goals: current.request.goals, results: current.results });
        this.store.mutate(id, run => { run.ai = ai; }, 'progress', { message: `AI analysis ${ai.status}` });
        terminal = job.stopState ?? terminal;
      }
      let error = job.reason ?? (terminal === 'failed' ? job.error ?? `Worker exited unexpectedly (${exitCode})` : null);
      // Publish a terminal state only after its report artifacts have been written successfully.
      const snapshot = this.store.get(id)!;
      const now = new Date().toISOString();
      const baseline = this.store.list(100).find(prior => prior.id !== id && prior.state === 'completed' && comparisonKey(prior) === comparisonKey(snapshot));
      await saveReports({ ...snapshot, progress: { ...snapshot.progress, currentScenarioId: null }, state: terminal, error, finishedAt: now, updatedAt: now, revision: snapshot.revision + 1 }, directory, baseline);
      // Cancellation may arrive during asynchronous report I/O. It still wins before the terminal commit.
      if (job.stopState && job.stopState !== terminal) {
        terminal = job.stopState; error = job.reason ?? null;
        await saveReports({ ...snapshot, progress: { ...snapshot.progress, currentScenarioId: null }, state: terminal, error, finishedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), revision: snapshot.revision + 1 }, directory, baseline);
      }
      this.store.transition(id, terminal, error);
    } catch (error) {
      const message = `Finalization failed: ${redactText(String(error))}`; this.failures.push(message);
      const current = this.store.get(id);
      if (current && !isTerminal(current.state)) this.store.transition(id, 'failed', message);
    } finally { if (job.forceTimer) clearTimeout(job.forceTimer); this.jobs.delete(id); job.resolveClosed(); this.schedule(); }
  }
  async shutdown(): Promise<void> {
    if (this.closing) return; this.closing = true; clearInterval(this.monitor);
    for (const run of this.store.queued()) this.cancel(run.id);
    for (const [id] of this.jobs) this.stop(id, 'cancelled', 'Backend shutting down');
    await Promise.all([...this.jobs.values()].map(job => job.closed));
  }
}
