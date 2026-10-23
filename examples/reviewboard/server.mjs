import Fastify from 'fastify';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';

const here = dirname(fileURLToPath(import.meta.url));
const digest = value => createHash('sha256').update(value).digest('hex');
// These accounts and their password are public, synthetic demo data.
export const DEMO_PASSWORD = 'reviewboard-demo';

/** A standalone, disposable local application. Hardcase is not imported here. */
export async function startReviewboard({ mode = 'clean', port = 4401, dataDir = '.engine/reviewboard/manual' } = {}) {
  if (!['clean', 'faulty'].includes(mode)) throw new Error('Mode must be clean or faulty');
  await mkdir(resolve(dataDir), { recursive: true });
  const db = new DatabaseSync(join(resolve(dataDir), 'reviewboard.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'Todo', version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, action TEXT NOT NULL, task_id INTEGER NOT NULL, at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  if (!db.prepare('SELECT value FROM metadata WHERE key = ?').get('seeded')) {
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const [id, name, role] of [['alex', 'Alex Chen', 'editor'], ['jamie', 'Jamie Rivera', 'viewer']]) {
        const salt = randomBytes(16).toString('hex');
        db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)').run(id, name, role, salt, scryptSync(DEMO_PASSWORD, salt, 64).toString('hex'));
      }
      db.prepare('INSERT INTO tasks (title) VALUES (?)').run('Review access rules');
      db.prepare('INSERT INTO tasks (title) VALUES (?)').run('Confirm launch checklist');
      db.prepare('INSERT INTO metadata VALUES (?, ?)').run('seeded', new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); db.close(); throw error; }
  }
  const app = Fastify({ logger: false, bodyLimit: 8192 });
  let origin;
  const publicUser = row => row ? { id: row.id, name: row.name, role: row.role } : null;
  function currentUser(request) {
    const token = /(?:^|;\s*)reviewboard_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.cookie ?? '')?.[1];
    if (!token) return null;
    return db.prepare('SELECT u.* FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = ? AND s.expires > ?').get(digest(token), Date.now()) ?? null;
  }
  function authenticated(request, reply) {
    const user = currentUser(request);
    if (!user) reply.code(401).send({ error: 'Sign in to use Reviewboard.' });
    return user;
  }
  const loginSchema = z.strictObject({ username: z.string().min(1).max(40), password: z.string().min(1).max(120) });
  const taskSchema = z.strictObject({ title: z.string().trim().min(1).max(120) });
  const moveSchema = z.strictObject({ state: z.literal('Done'), version: z.number().int().positive() });
  app.addHook('onRequest', async (request, reply) => {
    reply.header('cache-control', 'no-store');
    reply.header('x-content-type-options', 'nosniff');
    reply.header('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if (origin && request.headers.host !== new URL(origin).host) return reply.code(403).send({ error: 'Use the explicit local Reviewboard address.' });
    if (!['GET', 'HEAD'].includes(request.method) && request.headers.origin !== origin) return reply.code(403).send({ error: 'This action must originate from Reviewboard.' });
  });
  app.get('/', async (_request, reply) => reply.type('text/html').send(await readFile(join(here, 'public/index.html'))));
  for (const [path, type] of [['app.js', 'text/javascript'], ['styles.css', 'text/css']]) {
    app.get(`/${path}`, async (_request, reply) => reply.type(type).send(await readFile(join(here, 'public', path))));
  }
  app.get('/favicon.ico', async (_request, reply) => reply.code(204).send());
  app.get('/api/session', async request => ({ user: publicUser(currentUser(request)), mode }));
  app.post('/api/login', async (request, reply) => {
    const input = loginSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: 'Enter a username and password.' });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(input.data.username);
    const salt = user?.salt ?? 'synthetic-account-not-found';
    const candidate = scryptSync(input.data.password, salt, 64);
    const expected = user ? Buffer.from(user.password_hash, 'hex') : Buffer.alloc(64);
    if (!timingSafeEqual(candidate, expected) || !user) return reply.code(401).send({ error: 'Username or password is incorrect.' });
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires <= ?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(digest(token), user.id, Date.now() + 3600000);
    reply.header('set-cookie', `reviewboard_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`);
    return { user: publicUser(user) };
  });
  app.post('/api/logout', async (request, reply) => {
    const token = /(?:^|;\s*)reviewboard_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.cookie ?? '')?.[1];
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token));
    reply.header('set-cookie', 'reviewboard_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    return { ok: true };
  });
  app.get('/api/tasks', async (request, reply) => {
    if (!authenticated(request, reply)) return;
    return { tasks: db.prepare('SELECT * FROM tasks ORDER BY id').all(), activity: db.prepare('SELECT a.*, u.name AS actor_name FROM activity a JOIN users u ON a.actor = u.id ORDER BY a.id DESC LIMIT 8').all() };
  });
  app.post('/api/tasks', async (request, reply) => {
    const user = authenticated(request, reply); if (!user) return;
    if (user.role !== 'editor') return reply.code(403).send({ error: 'Only editors can create tasks.' });
    const input = taskSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: 'Use a task title of 1–120 characters.' });
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = db.prepare('INSERT INTO tasks (title) VALUES (?)').run(input.data.title);
      const id = Number(result.lastInsertRowid);
      db.prepare('INSERT INTO activity (actor, action, task_id, at) VALUES (?, ?, ?, ?)').run(user.id, 'created', id, new Date().toISOString());
      db.exec('COMMIT');
      return reply.code(201).send({ task: db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) });
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  });
  app.patch('/api/tasks/:id', async (request, reply) => {
    const user = authenticated(request, reply); if (!user) return;
    // Intentional test defect: only faulty mode omits the status-change role check.
    // Authentication, CSRF, input validation and optimistic concurrency stay enabled.
    if (mode === 'clean' && user.role !== 'editor') return reply.code(403).send({ error: 'Viewers cannot change task status.' });
    const id = Number(request.params.id);
    const input = moveSchema.safeParse(request.body);
    if (!Number.isSafeInteger(id) || id < 1 || !input.success) return reply.code(400).send({ error: 'Invalid task change.' });
    db.exec('BEGIN IMMEDIATE');
    try {
      const before = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
      if (!before) { db.exec('ROLLBACK'); return reply.code(404).send({ error: 'Task not found.' }); }
      if (before.version !== input.data.version) { db.exec('ROLLBACK'); return reply.code(409).send({ error: 'This task changed. Refresh the board and try again.' }); }
      if (before.state !== input.data.state) {
        db.prepare('UPDATE tasks SET state = ?, version = version + 1 WHERE id = ?').run(input.data.state, id);
        db.prepare('INSERT INTO activity (actor, action, task_id, at) VALUES (?, ?, ?, ?)').run(user.id, 'completed', id, new Date().toISOString());
      }
      db.exec('COMMIT');
      return { task: db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) };
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  });
  try { origin = await app.listen({ port, host: '127.0.0.1' }); }
  catch (error) { db.close(); throw error; }
  return { origin, mode, dataDir: resolve(dataDir), close: async () => { await app.close(); db.close(); } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = await startReviewboard({ mode: process.argv.includes('--faulty') ? 'faulty' : 'clean', port: Number(process.env.REVIEWBOARD_PORT ?? 4401), dataDir: process.env.REVIEWBOARD_DATA_DIR ?? '.engine/reviewboard/manual' });
  console.log(`Reviewboard ${server.mode}: ${server.origin}`);
  console.log(`Synthetic accounts: alex (editor), jamie (viewer). Password: ${DEMO_PASSWORD}`);
  let closing = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { if (closing) return; closing = true; await server.close(); process.exit(0); });
}
