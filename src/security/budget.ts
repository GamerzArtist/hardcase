import { setTimeout as delay } from 'node:timers/promises';
import type { Budget } from '../domain/models.js';
export class BudgetError extends Error { readonly code = 'BUDGET_EXCEEDED'; }
export class BudgetGuard {
  private count = 0;
  private nextAt = 0;
  private active = 0;
  private readonly waiters: Array<{ wake(): void; reject(reason: unknown): void }> = [];
  private readonly started = Date.now();
  constructor(readonly budget: Budget, readonly signal: AbortSignal) {}
  get requests(): number { return this.count; }
  get remaining(): number { return this.budget.maxRequests - this.count; }
  check(): void {
    this.signal.throwIfAborted();
    if (Date.now() - this.started >= this.budget.maxDurationMs) throw new BudgetError('Run duration budget exhausted');
  }
  async request(): Promise<void> {
    this.check();
    if (this.count >= this.budget.maxRequests) throw new BudgetError('Network request budget exhausted');
    // Reserve synchronously before waiting: concurrent callers cannot oversubscribe either cap.
    this.count++;
    const now = Date.now();
    const slot = Math.max(now, this.nextAt);
    this.nextAt = slot + 1000 / this.budget.requestsPerSecond;
    if (slot > now) await delay(slot - now, undefined, { signal: this.signal });
    this.check();
  }
  async acquire(): Promise<() => void> {
    this.check();
    if (this.active >= this.budget.maxConcurrency) {
      if (this.waiters.length >= 50) throw new BudgetError('Pending request queue is full');
      await new Promise<void>((resolve, reject) => {
        const abort = (): void => { const index = this.waiters.indexOf(waiter); if (index >= 0) this.waiters.splice(index, 1); reject(this.signal.reason); };
        const waiter = { wake: (): void => { this.signal.removeEventListener('abort', abort); resolve(); }, reject };
        this.waiters.push(waiter); this.signal.addEventListener('abort', abort, { once: true });
      });
    } else this.active++;
    let released = false;
    const release = (): void => {
      if (released) return; released = true;
      const waiter = this.waiters.shift(); if (waiter) waiter.wake(); else this.active--;
    };
    try { await this.request(); return release; } catch (error) { release(); throw error; }
  }
}
