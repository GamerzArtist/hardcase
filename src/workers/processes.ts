import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const executeFile = promisify(execFile);
export function isProcessAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false; return true; }
}
export async function killOwnedProcessTree(pid: number | undefined, group = false): Promise<void> {
  if (!pid || pid === process.pid || !isProcessAlive(pid)) return;
  if (process.platform === 'win32') {
    try { await executeFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 5000 }); }
    catch (error) { if (isProcessAlive(pid)) throw error; }
  } else {
    try { process.kill(group ? -pid : pid, 'SIGKILL'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  }
}
