import Fastify, { LogController } from 'fastify';
import { timingSafeEqual, randomBytes } from 'node:crypto';
import { mkdir, open, readFile, writeFile, unlink, realpath } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import { z } from 'zod';
import { loadConfig, type EngineConfig } from '../config.js';
import { CreateRunSchema, ENGINE_VERSION, LEVEL_NAMES, ScenarioSchema, TargetSchema, isTerminal, type CreateRun, type RunEvent, type Run } from '../domain/models.js';
import { RunStore } from '../persistence/store.js';
import { RunManager } from '../orchestration/manager.js';
import { RECIPES, findRecipe } from '../strategies/catalog.js';
import { SafetyError, validateScenario, validateTarget } from '../security/targets.js';
import { redact, redactText } from '../security/redact.js';
import { compareRuns, makeReport, markdownReport, sanitizedRun, saveReports } from '../reporting/reports.js';
import { CompareSchema, EvidenceParamsSchema, IdParamsSchema, ReplaySchema, openApiDocument } from './contracts.js';
import { isProcessAlive } from '../workers/processes.js';
import { cleanupDisposable } from '../workers/cleanup.js';

class ApiError extends Error { constructor(readonly statusCode: number, message: string) { super(message); } }
export function validateRunRequest(raw: unknown, forbiddenPorts: number[] = []): CreateRun {
  const request = CreateRunSchema.parse(raw);
  request.target = validateTarget(request.target, forbiddenPorts);
  if (request.levels.some(level => level >= 3) && !request.allowFixtureFaults) throw new SafetyError('Levels 3–5 require explicit allowFixtureFaults: true and an engine-owned disposable fixture');
  if (new Set(request.levels).size !== request.levels.length) throw new SafetyError('Duplicate levels are not allowed');
  if (request.target.kind === 'loopback') {
    if (request.levels.some(level => level > 2)) throw new SafetyError('Levels 3–5 require engine-owned disposable fixtures');
    if (!request.scenarios.length || request.recipeIds?.length) throw new SafetyError('Loopback targets require explicit custom scenarios and cannot use fixture recipes');
  }
  if (request.recipeIds && (!request.recipeIds.length && !request.scenarios.length || new Set(request.recipeIds).size !== request.recipeIds.length)) throw new SafetyError('Empty execution plan or duplicate recipe IDs');
  for (const id of request.recipeIds ?? []) {
    const recipe = findRecipe(id); if (!recipe || !request.levels.includes(recipe.level)) throw new SafetyError('Unknown recipe or recipe level not selected');
  }
  const ids = new Set(RECIPES.map(recipe => recipe.id));
  for (const scenario of request.scenarios) {
    validateScenario(scenario);
    if (ids.has(scenario.id)) throw new SafetyError('Scenario IDs must be unique and cannot shadow built-in recipes');
    ids.add(scenario.id);
    if (!request.levels.includes(scenario.level)) throw new SafetyError('Custom scenario level must be selected');
  }
  return request;
}
export async function createEngine(overrides: Partial<EngineConfig> = {}, internal: { workerPath?: string } = {}) {
  const config = loadConfig(overrides);
  await mkdir(config.dataDir, { recursive: true }); await mkdir(config.artifactDir, { recursive: true });
  const lockPath = join(config.dataDir, 'engine.lock');
  async function acquireLock(): Promise<void> {
    try { const handle = await open(lockPath, 'wx', 0o600); await handle.writeFile(JSON.stringify({ pid: process.pid })); await handle.close(); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const lock = JSON.parse(await readFile(lockPath, 'utf8')) as { pid: number };
      if (!Number.isSafeInteger(lock.pid) || isProcessAlive(lock.pid)) throw new Error('Data directory is already owned by another engine process');
      await unlink(lockPath); await acquireLock();
    }
  }
  await acquireLock();
  const token = config.token ?? randomBytes(32).toString('base64url');
  const store = new RunStore(join(config.dataDir, 'history.sqlite'));
  const manager = new RunManager(store, config, internal.workerPath);
  const app = Fastify({ logger: config.logger ? { redact: ['req.headers.authorization', 'req.headers.cookie'], level: 'info' } : false,
    logController: new LogController({ disableRequestLogging: true }), bodyLimit: 131072, requestTimeout: 10000, connectionTimeout: 15000, forceCloseConnections: true,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
  });
  let port = config.port; let closed = false; const eventClients = new Set<() => void>();
  const authorized = (value: string | undefined): boolean => {
    if (!value?.startsWith('Bearer ')) return false;
    const supplied = Buffer.from(value.slice(7)); const expected = Buffer.from(token);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  };
  app.addHook('onRequest', async (request, reply) => {
    reply.header('cache-control', 'no-store').header('x-content-type-options', 'nosniff');
    const host = request.headers.host;
    if (!host || !['127.0.0.1', `127.0.0.1:${port}`, 'localhost', `localhost:${port}`].includes(host)) throw new ApiError(403, 'Host is not an approved local address');
    const origin = request.headers.origin;
    if (origin && !config.allowedOrigins.includes(origin)) throw new ApiError(403, 'Origin is not allowed');
    if (origin) reply.header('access-control-allow-origin', origin).header('vary', 'Origin');
    if (request.method === 'OPTIONS') {
      if (!origin) throw new ApiError(403, 'CORS preflight requires an allowed origin');
      return reply.header('access-control-allow-methods', 'GET,POST,OPTIONS').header('access-control-allow-headers', 'Authorization,Content-Type,Last-Event-ID').code(204).send();
    }
    if (request.url.split('?')[0] !== '/v1/health' && !authorized(request.headers.authorization)) throw new ApiError(401, 'A local Bearer session token is required');
  });
  app.setErrorHandler((error, _request, reply) => {
    const code = error instanceof z.ZodError || error instanceof SafetyError ? 400 : error instanceof ApiError ? error.statusCode : typeof (error as { statusCode?: number }).statusCode === 'number' ? (error as { statusCode: number }).statusCode : 500;
    const message = error instanceof z.ZodError ? error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') : error instanceof Error ? error.message : 'Unexpected error';
    if (code >= 500) app.log.error({ error: redactText(message) }, 'API operation failed');
    return reply.code(code).send({ error: code >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_REJECTED', message: code >= 500 ? 'Operation failed; inspect local engine logs' : redactText(message) });
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'NOT_FOUND', message: 'Unknown API route' }));
  const getRun = (params: unknown): Run => { const { id } = IdParamsSchema.parse(params); const run = store.get(id); if (!run) throw new ApiError(404, 'Run not found'); return run; };
  app.get('/v1/health', async () => ({ ok: true, version: ENGINE_VERSION }));
  app.get('/v1/capabilities', async () => ({ version: ENGINE_VERSION, apiVersion: 'v1',
    levels: Object.entries(LEVEL_NAMES).map(([level, name]) => ({ level: Number(level), name, targetKinds: Number(level) <= 2 ? ['fixture', 'loopback'] : ['fixture'] })),
    targetKinds: ['fixture', 'loopback'], aiOptional: true, aiConfigured: process.env.AI_ENABLED === 'true' && !!process.env.AI_ENDPOINT && !!process.env.AI_MODEL,
    limits: { maxConcurrentJobs: config.maxConcurrentJobs, maxQueuedJobs: config.maxQueuedJobs, maxRequests: 400, maxDurationMs: 180000, maxConcurrency: 4, requestsPerSecond: 20, maxArtifactBytes: 67108864 },
    restrictions: ['Public, private-LAN and cloud targets are unsupported.', 'Levels 3–5 only operate on engine-created disposable fixtures.', 'AI suggestions are never executed automatically.', 'Browser redirects, downloads, service workers and WebSockets are disabled.'],
  }));
  app.post('/v1/targets/validate', async request => validateTarget(TargetSchema.parse(request.body), manager.forbiddenPorts));
  app.get('/v1/recipes', async () => RECIPES);
  app.get('/v1/scenarios/schema', async () => z.toJSONSchema(ScenarioSchema));
  app.post('/v1/scenarios/validate', async request => { const scenario = ScenarioSchema.parse(request.body); validateScenario(scenario); return scenario; });
  app.get('/v1/openapi.json', async () => openApiDocument());
  app.post('/v1/runs', async (request, reply) => {
    const input = validateRunRequest(request.body, manager.forbiddenPorts);
    if (store.queued().length >= config.maxQueuedJobs) throw new ApiError(429, 'Run queue is full');
    const run = manager.create(input); app.log.info({ runId: run.id, levels: input.levels, targetKind: input.target.kind }, 'Run queued');
    return reply.code(202).send(sanitizedRun(run));
  });
  app.get('/v1/runs', async request => {
    const query = z.strictObject({ limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).max(1000000).default(0) }).parse(request.query);
    return store.list(query.limit, query.offset).map(sanitizedRun);
  });
  app.get('/v1/runs/:id', async request => sanitizedRun(getRun(request.params)));
  app.post('/v1/runs/:id/cancel', async (request, reply) => { const run = getRun(request.params); return reply.code(202).send(sanitizedRun(manager.cancel(run.id))); });
  app.get('/v1/runs/:id/findings', async request => sanitizedRun(getRun(request.params)).results);
  app.get('/v1/runs/:id/evidence', async request => getRun(request.params).evidence);
  app.get('/v1/runs/:id/evidence/:artifactId', async (request, reply) => {
    const { id, artifactId } = EvidenceParamsSchema.parse(request.params); const run = store.get(id); if (!run) throw new ApiError(404, 'Run not found');
    const artifact = run.evidence.find(e => e.id === artifactId); if (!artifact) throw new ApiError(404, 'Artifact not found');
    if (!/^[a-f0-9-]+\.(png|zip|json)$/.test(artifact.relativePath)) throw new ApiError(500, 'Invalid artifact record');
    const root = await realpath(join(config.artifactDir, id)); let path: string;
    try { path = await realpath(join(root, artifact.relativePath)); } catch { throw new ApiError(404, 'Artifact file is unavailable'); }
    const contained = relative(root, path); if (contained.startsWith('..') || isAbsolute(contained)) throw new ApiError(403, 'Artifact path escapes run storage');
    return reply.header('content-disposition', `attachment; filename="${artifact.relativePath}"`).type(artifact.mediaType).send(createReadStream(path));
  });
  app.get('/v1/runs/:id/report', async (request, reply) => {
    const run = getRun(request.params); const { format, compareTo } = z.strictObject({ format: z.enum(['json', 'markdown']).default('json'), compareTo: z.string().uuid().optional() }).parse(request.query);
    const baseline = compareTo ? store.get(compareTo) : undefined;
    if (compareTo && !baseline) throw new ApiError(404, 'Baseline run not found');
    if (baseline && (!isTerminal(run.state) || !isTerminal(baseline.state))) throw new ApiError(409, 'Comparison requires terminal runs');
    let report;
    try { report = makeReport(run, baseline); } catch { throw new ApiError(409, 'Report baseline is incompatible'); }
    return format === 'markdown' ? reply.type('text/markdown; charset=utf-8').header('content-disposition', 'attachment; filename="report.md"').send(markdownReport(report)) : reply.send(report);
  });
  app.post('/v1/runs/:id/replay', async (request, reply) => {
    const run = getRun(request.params); const { scenarioIds } = ReplaySchema.parse(request.body);
    if (!isTerminal(run.state) || run.request.target.kind !== 'fixture') throw new ApiError(409, 'Only terminal fixture runs can be replayed');
    if (new Set(scenarioIds).size !== scenarioIds.length || scenarioIds.some(id => !run.results.some(r => r.scenarioId === id && r.replayable))) throw new ApiError(400, 'One or more scenarios are not eligible for replay');
    const results = run.results.filter(r => scenarioIds.includes(r.scenarioId));
    const input = validateRunRequest({ ...run.request, levels: [...new Set(results.map(r => r.level))], recipeIds: scenarioIds.filter(id => !!findRecipe(id)), scenarios: run.request.scenarios.filter(s => scenarioIds.includes(s.id)) }, manager.forbiddenPorts);
    return reply.code(202).send(sanitizedRun(manager.create(input, run.id)));
  });
  app.post('/v1/compare', async request => {
    const ids = CompareSchema.parse(request.body); const before = store.get(ids.before); const after = store.get(ids.after);
    if (!before || !after) throw new ApiError(404, 'Run not found');
    if (!isTerminal(before.state) || !isTerminal(after.state)) throw new ApiError(409, 'Both runs must be terminal');
    try { return compareRuns(before, after); } catch (error) { throw new ApiError(409, error instanceof Error ? error.message : 'Runs are incompatible'); }
  });
  app.get('/v1/runs/:id/events', async (request, reply) => {
    const run = getRun(request.params);
    if (eventClients.size >= 20) throw new ApiError(429, 'Too many event streams');
    const query = z.strictObject({ after: z.coerce.number().int().min(0).default(0) }).parse(request.query);
    const lastId = request.headers['last-event-id'];
    const after = lastId === undefined ? query.after : z.coerce.number().int().min(0).parse(lastId);
    reply.hijack();
    reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Content-Type-Options': 'nosniff', ...(request.headers.origin ? { 'Access-Control-Allow-Origin': request.headers.origin, Vary: 'Origin' } : {}) });
    let stopped = false; let last = after;
    const close = (): void => { if (stopped) return; stopped = true; clearInterval(heartbeat); store.events.off(run.id, send); eventClients.delete(close); reply.raw.end(); };
    const send = (event: RunEvent): void => {
      if (stopped || event.id <= last) return; last = event.id;
      if (reply.raw.writableLength > 65536) { close(); return; }
      reply.raw.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(redact(event))}\n\n`);
      if (event.type === 'state' && typeof event.data.state === 'string' && isTerminal(event.data.state as Run['state'])) close();
    };
    const heartbeat = setInterval(() => { if (!stopped) reply.raw.write(': heartbeat\n\n'); }, 10000); heartbeat.unref();
    eventClients.add(close); request.raw.on('close', close); reply.raw.on('close', close);
    store.events.on(run.id, send);
    for (const event of store.history(run.id, after)) send(event);
    if (isTerminal(store.get(run.id)!.state)) close();
  });
  async function close(): Promise<void> {
    if (closed) return; closed = true;
    for (const stop of eventClients) stop();
    await manager.shutdown(); await app.close(); store.close();
    await unlink(lockPath);
  }
  async function listen(): Promise<string> {
    try {
      const origin = await app.listen({ host: config.host, port: config.port });
      const address = app.server.address(); if (!address || typeof address === 'string') throw new Error('API address unavailable');
      port = address.port; manager.forbiddenPorts = [port];
      await writeFile(join(config.dataDir, 'session.json'), JSON.stringify({ origin, token, apiVersion: 'v1', pid: process.pid }, null, 2), { mode: 0o600 });
      const interrupted = store.active();
      for (const run of interrupted) await cleanupDisposable(join(config.artifactDir, run.id));
      manager.start();
      for (const run of interrupted) await saveReports(store.get(run.id)!, join(config.artifactDir, run.id));
      return origin;
    } catch (error) { await close(); throw error; }
  }
  return { app, store, manager, config, token, listen, close };
}
