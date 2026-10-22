import { executeRun } from '../strategies/execute.js';
import type { WorkerInput, WorkerMessage } from '../domain/models.js';
import { redactText } from '../security/redact.js';
import { killOwnedProcessTree } from './processes.js';

const controller = new AbortController(); let started = false; let browserPid: number | undefined;
const emit = (message: WorkerMessage): void => {
  if (!process.connected) return;
  // Parent death can race the connected check. A send callback prevents an unhandled EPIPE from bypassing cleanup.
  try { process.send?.(message, undefined, undefined, (error: Error | null) => { if (error) void terminate(); }); }
  catch { void terminate(); }
};
const heartbeat = setInterval(() => emit({ type: 'heartbeat' }), 500); heartbeat.unref();
async function terminate(): Promise<void> {
  controller.abort(new Error('Run cancelled'));
  const fallback = setTimeout(() => { void killOwnedProcessTree(browserPid).finally(() => process.exit(1)); }, 5000); fallback.unref();
}
process.on('message', (message: { type: string; input?: WorkerInput }) => {
  if (message.type === 'cancel') { void terminate(); return; }
  if (message.type !== 'start' || !message.input || started) return;
  started = true;
  void executeRun(message.input, controller.signal, emit, pid => { browserPid = pid; emit({ type: 'browser', pid }); })
    .then(() => { clearInterval(heartbeat); if (process.connected) process.disconnect(); process.exitCode = 0; })
    .catch(async error => {
      emit({ type: 'error', message: redactText(error instanceof Error ? error.message : String(error)) });
      await killOwnedProcessTree(browserPid); clearInterval(heartbeat);
      if (process.connected) process.disconnect(); process.exitCode = 1;
    });
});
process.on('disconnect', () => { void terminate(); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void terminate(); });
