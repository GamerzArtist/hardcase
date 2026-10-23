import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { CreateRun } from '../domain/models.js';

export const IdempotencyKeySchema = z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/, 'Idempotency-Key must be 8–128 ASCII letters, digits, dot, underscore, colon or hyphen');
export interface IdempotencyRecord { key: string; requestHash: string; }
export class IdempotencyConflict extends Error {
  constructor() { super('Idempotency-Key already belongs to a different request. Reconcile the original run or use a new key for an intentional new operation.'); }
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)]));
  return value;
}
export function idempotencyRecord(header: unknown, request: CreateRun, replayOf: string | null = null): IdempotencyRecord | undefined {
  if (header === undefined) return undefined;
  const key = IdempotencyKeySchema.parse(header);
  return { key, requestHash: createHash('sha256').update(JSON.stringify(canonical({ request, replayOf }))).digest('hex') };
}
