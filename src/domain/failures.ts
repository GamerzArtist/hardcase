export function failureCode(message: string): string {
  if (/cancelled|shutting down/i.test(message)) return 'CANCELLED';
  if (/backend restarted/i.test(message)) return 'RESTART_INTERRUPTED';
  if (/execution deadline/i.test(message)) return 'RUN_TIMEOUT';
  if (/heartbeat/i.test(message)) return 'WORKER_HEARTBEAT_LOST';
  if (/evidence capture|finalization failed/i.test(message)) return 'EVIDENCE_CAPTURE_FAILED';
  if (/executable doesn't exist|browser.*launch|launchServer|browser is not started/i.test(message)) return 'BROWSER_UNAVAILABLE';
  if (/budget|byte limit|request limit/i.test(message)) return 'BUDGET_EXHAUSTED';
  if (/redirect|approved origin|loopback|pinned numeric|two-page limit|websocket/i.test(message)) return 'SCOPE_BLOCKED';
  if (/ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH|fetch failed/i.test(message)) return 'TARGET_UNREACHABLE';
  if (/TARGET_TIMEOUT|operation was aborted due to timeout/i.test(message)) return 'TARGET_TIMEOUT';
  if (/worker exited|worker cleanup|ipc/i.test(message)) return 'WORKER_CRASH';
  return 'EXECUTION_ERROR';
}
