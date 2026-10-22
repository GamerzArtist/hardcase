import Fastify, { type FastifyInstance } from 'fastify';
import { DatabaseSync } from 'node:sqlite';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';

export const FIXTURE_POLICY = {
  permission: 'viewer may read notes but must receive 403 for POST /api/admin/reset; admin may perform it',
  costCeiling: 100, maxTokensPerRequest: 80, queueCapacity: 1, eventWindowLimit: 4,
  maxDependencyAttempts: 2, initialBalance: 100,
};
export interface FixtureFaults { dependencyDown: boolean; dependencyTimeout: boolean; failWrite: boolean; delayMs: number; queueDelayMs: number; }
export interface FixtureHandle {
  baseUrl: string; app: FastifyInstance; close(): Promise<void>; reset(): Promise<void>;
  setFaults(faults: Partial<FixtureFaults>): void;
}
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Disposable test fixture</title><style>body{font:18px system-ui;margin:24px;max-width:720px}input,button,textarea{font:inherit;max-width:100%;box-sizing:border-box}label{display:block;margin-top:16px}li{overflow-wrap:anywhere}nav{margin-bottom:24px}button{margin:8px 4px 8px 0;padding:8px}textarea{width:100%}</style>
<nav><a href="/">Notes</a> <a href="/about">About</a></nav><main><h1>Test notes</h1>
<form id="note-form"><label for="note-title">Note title</label><input id="note-title" name="title" required maxlength="80"><button id="save-note" type="submit">Save note</button></form>
<p id="note-status" role="status"></p><ul id="notes"></ul>
<label for="draft">Draft</label><textarea id="draft" maxlength="500"></textarea><button id="save-draft">Save draft</button><p id="draft-status" role="status"></p>
<p>This isolated application uses synthetic data only.</p></main>
<script>
const title=document.querySelector('#note-title'), status=document.querySelector('#note-status'), draft=document.querySelector('#draft');
let operationId='initial';title.addEventListener('input',()=>operationId=crypto.randomUUID());
async function load(){const response=await fetch('/api/notes');const notes=await response.json();const list=document.querySelector('#notes');list.replaceChildren();for(const n of notes){const li=document.createElement('li');li.textContent=n.title;list.append(li);}}
document.querySelector('#note-form').addEventListener('submit',async e=>{e.preventDefault();status.textContent='Saving';try{const r=await fetch('/api/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:title.value,operationId})});status.textContent=r.ok?'Saved':'Rejected';await load();}catch{status.textContent='Failed; retry is available';}});
document.querySelector('#save-draft').addEventListener('click',async()=>{const r=await fetch('/api/draft',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:draft.value})});document.querySelector('#draft-status').textContent=r.ok?'Saved':'Failed';});
Promise.all([load(),fetch('/api/draft').then(r=>r.json()).then(v=>draft.value=v.text)]).then(()=>document.querySelector('main').setAttribute('data-ready','true'));
</script></html>`;

export async function startFixture(options: { variant: 'clean' | 'faulty'; directory: string; port?: number }): Promise<FixtureHandle> {
  await mkdir(options.directory, { recursive: true });
  const db = new DatabaseSync(join(options.directory, 'fixture.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, operation_id TEXT NOT NULL); CREATE TABLE IF NOT EXISTS state(key TEXT PRIMARY KEY, value TEXT NOT NULL);');
  const app = Fastify({ logger: false, bodyLimit: 8192, requestTimeout: 5000, forceCloseConnections: true });
  let faults: FixtureFaults = { dependencyDown: false, dependencyTimeout: false, failWrite: false, delayMs: 0, queueDelayMs: 250 };
  let spent = 0; let costCalls = 0; let adminActions = 0; let dependencyAttempts = 0;
  const costOperations = new Map<string, number>(); const transferOperations = new Set<string>(); const events = new Set<string>();
  let queue = 0; let queuePeak = 0; let windowAt = 0; let windowCalls = 0; let acceptedEvents = 0; let simulatedVolume = 0;
  const clean = options.variant === 'clean';
  const getValue = (key: string): string => (db.prepare('SELECT value FROM state WHERE key = ?').get(key) as { value: string } | undefined)?.value ?? '';
  const setValue = (key: string, value: string): void => { db.prepare('INSERT INTO state(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value); };
  if (!getValue('balance')) { setValue('balance', '100'); setValue('ledger', '0'); setValue('draft', ''); }
  app.get('/', async (_request, reply) => reply.type('text/html').send(html));
  app.get('/about', async (_request, reply) => reply.type('text/html').send('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Fixture about</title><h1>About this fixture</h1><a href="/">Notes</a></html>'));
  app.get('/health', async () => ({ ok: true, variant: options.variant }));
  app.get('/api/policy', async () => FIXTURE_POLICY);
  app.get('/api/notes', async () => db.prepare('SELECT id,title FROM notes ORDER BY id').all());
  app.post('/api/notes', async (request, reply) => {
    const parsed = z.strictObject({ title: z.string().trim().min(1).max(80), operationId: z.string().min(1).max(100) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Title must have 1 to 80 characters and an operation ID is required' });
    await delay(Math.min(1000, 80 + faults.delayMs));
    const { title, operationId } = parsed.data;
    const existing = db.prepare('SELECT id,title FROM notes WHERE operation_id=?').get(operationId);
    if (clean && existing) return existing;
    const row = db.prepare('INSERT INTO notes(title,operation_id) VALUES (?,?)').run(title, operationId);
    return reply.code(201).send({ id: Number(row.lastInsertRowid), title });
  });
  app.get('/api/draft', async () => ({ text: getValue('draft') }));
  app.put('/api/draft', async (request, reply) => {
    const parsed = z.strictObject({ text: z.string().max(500) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid draft' });
    if (clean) setValue('draft', parsed.data.text); // Faulty variant falsely acknowledges a discarded write.
    return { saved: true };
  });
  app.post('/api/admin/reset', async (request, reply) => {
    const role = request.headers['x-test-role'];
    if (role !== 'admin' && (clean || role !== 'viewer')) return reply.code(403).send({ error: 'Forbidden' });
    adminActions++;
    return { performed: true };
  });
  app.post('/api/ai', async (request, reply) => {
    const parsed = z.strictObject({ tokens: z.number().int().min(1).max(80), operationId: z.string().min(1).max(100) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid simulated request' });
    const { tokens, operationId } = parsed.data;
    if (clean && costOperations.has(operationId)) return { tokens: costOperations.get(operationId), spent, simulated: true, replay: true };
    if (clean && spent + tokens > FIXTURE_POLICY.costCeiling) return reply.code(402).send({ error: 'Simulated budget exceeded', spent, simulated: true });
    spent += tokens; costCalls++; costOperations.set(operationId, tokens);
    return { tokens, spent, simulated: true };
  });
  app.post('/api/events', async (request, reply) => {
    const parsed = z.strictObject({ eventId: z.string().min(1).max(100), simulatedVolume: z.number().int().min(1).max(20).default(1) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid synthetic event' });
    if (Date.now() - windowAt >= 1000) { windowAt = Date.now(); windowCalls = 0; }
    windowCalls++;
    if (clean && (windowCalls > FIXTURE_POLICY.eventWindowLimit || queue >= FIXTURE_POLICY.queueCapacity)) return reply.code(429).send({ error: 'Queue or rate limit', retryAfterMs: 1000 });
    queue++; queuePeak = Math.max(queuePeak, queue);
    try {
      await delay(faults.queueDelayMs);
      if (!clean || !events.has(parsed.data.eventId)) { acceptedEvents++; simulatedVolume += parsed.data.simulatedVolume; events.add(parsed.data.eventId); }
      return { accepted: true, queue, simulated: true };
    } finally { queue--; }
  });
  app.post('/api/transfer', async (request, reply) => {
    const parsed = z.strictObject({ amount: z.number().int().min(1).max(10), operationId: z.string().min(1).max(100) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid simulated transfer' });
    const { amount, operationId } = parsed.data;
    if (transferOperations.has(operationId)) return { committed: true, replay: true, simulated: true };
    if (!clean) setValue('balance', String(Number(getValue('balance')) - amount));
    for (let attempt = 1; attempt <= FIXTURE_POLICY.maxDependencyAttempts; attempt++) {
      dependencyAttempts++;
      if (!faults.dependencyDown && !faults.dependencyTimeout) break;
      await delay(faults.dependencyTimeout ? 60 : 40);
      if (attempt === FIXTURE_POLICY.maxDependencyAttempts) return reply.code(faults.dependencyTimeout ? 504 : 503).send({ error: faults.dependencyTimeout ? 'Simulated dependency timeout' : 'Simulated dependency unavailable', attempts: attempt });
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      if (clean) setValue('balance', String(Number(getValue('balance')) - amount));
      if (faults.failWrite) throw new Error('Injected write failure');
      setValue('ledger', String(Number(getValue('ledger')) + amount));
      db.exec('COMMIT'); transferOperations.add(operationId);
      return { committed: true, simulated: true };
    } catch {
      db.exec('ROLLBACK');
      return reply.code(503).send({ error: 'Simulated write unavailable' });
    }
  });
  app.get('/api/state', async () => ({ noteCount: Number((db.prepare('SELECT count(*) AS n FROM notes').get() as { n: number }).n),
    draft: getValue('draft'), spent, costCalls, adminActions, dependencyAttempts,
    balance: Number(getValue('balance')), ledger: Number(getValue('ledger')), queue, queuePeak, acceptedEvents, simulatedVolume }));
  app.get('/redirect-external', async (_request, reply) => reply.redirect('http://169.254.169.254/latest/meta-data/'));
  app.get('/delay', async () => { await delay(2500); return { delayed: true }; });
  await app.listen({ host: '127.0.0.1', port: options.port ?? 0 });
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture address unavailable');
  let closed = false;
  return {
    app, baseUrl: `http://127.0.0.1:${address.port}`,
    setFaults(next) { faults = { ...faults, ...next, delayMs: Math.min(1000, Math.max(0, next.delayMs ?? faults.delayMs)), queueDelayMs: Math.min(1000, Math.max(0, next.queueDelayMs ?? faults.queueDelayMs)) }; },
    async reset() {
      if (queue) throw new Error('Cannot reset fixture while work is active');
      db.exec('DELETE FROM notes; DELETE FROM sqlite_sequence WHERE name=\'notes\'; DELETE FROM state;');
      setValue('balance', '100'); setValue('ledger', '0'); setValue('draft', '');
      spent = 0; costCalls = 0; adminActions = 0; dependencyAttempts = 0; queuePeak = 0; windowAt = 0; windowCalls = 0; acceptedEvents = 0; simulatedVolume = 0;
      costOperations.clear(); transferOperations.clear(); events.clear();
      faults = { dependencyDown: false, dependencyTimeout: false, failWrite: false, delayMs: 0, queueDelayMs: 250 };
    },
    async close() { if (closed) return; closed = true; try { await app.close(); } finally { db.close(); } },
  };
}
