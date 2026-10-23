import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import type { Page, BrowserContext } from 'playwright';
import { ENGINE_VERSION, emptyMetrics, type AssertionOutcome, type Attempt, type Recipe, type ScenarioDefinition, type ScenarioResult, type WorkerEmit, type WorkerInput } from '../domain/models.js';
import { BrowserSession, type BrowserObservations } from '../browser/session.js';
import { evaluateAssertion } from '../assertions/evaluate.js';
import { EvidenceStore } from '../evidence/store.js';
import { startFixture, FIXTURE_POLICY, type FixtureHandle } from '../fixtures/app.js';
import { BudgetError, BudgetGuard } from '../security/budget.js';
import { SafeHttp, type HttpObservation } from '../security/http.js';
import { validateScenario, validateTarget } from '../security/targets.js';
import { redactText } from '../security/redact.js';
import { RECIPES } from './catalog.js';
import { failureCode } from '../domain/failures.js';

interface AttemptContext {
  page?: Page; fixture?: FixtureHandle; baseUrl: string; guard: BudgetGuard; http: SafeHttp;
  actions: Attempt['actions']; assertions: AssertionOutcome[]; observations?: BrowserObservations;
  record(action: string, details?: unknown): void;
  assert(id: string, description: string, expected: unknown, observed: unknown): void;
}
const recordObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Fixture returned an unexpected data shape');
  return value as Record<string, unknown>;
};
const expectedState = async (c: AttemptContext): Promise<Record<string, unknown>> => {
  const response = await c.http.request(`${c.baseUrl}/api/state`);
  if (response.status !== 200) throw new Error('Cannot inspect fixture state');
  return recordObject(response.body);
};
async function navigate(c: AttemptContext, path = '/'): Promise<void> {
  c.record('navigate', { path });
  await c.page!.goto(`${c.baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
  if (path === '/') await c.page!.locator('main[data-ready="true"]').waitFor();
}
async function refresh(c: AttemptContext): Promise<void> {
  c.record('reload'); await c.page!.reload({ waitUntil: 'domcontentloaded' });
  await c.page!.locator('main[data-ready="true"]').waitFor();
}
async function runBuiltin(id: string, c: AttemptContext): Promise<void> {
  c.guard.check();
  const page = c.page;
  switch (id) {
    case 'normal.workflow': {
      await navigate(c);
      c.record('fill', { selector: '#note-title', value: 'Ordinary note' }); await page!.locator('#note-title').fill('Ordinary note');
      c.record('click', { selector: '#save-note' }); await page!.locator('#save-note').click();
      await page!.locator('#notes li').first().waitFor();
      c.assert('saved', 'A valid note is rendered', 'Ordinary note', await page!.locator('#notes li').first().textContent());
      await refresh(c); c.assert('reload', 'Saved note persists after reload', 1, await page!.locator('#notes li').count());
      c.record('click', { selector: 'a[href="/about"]' }); await page!.locator('a[href="/about"]').click();
      c.assert('link', 'About link navigates', '/about', new URL(page!.url()).pathname);
      c.record('back'); await page!.goBack(); await page!.locator('main[data-ready="true"]').waitFor();
      c.assert('back', 'Back returns to notes', '/', new URL(page!.url()).pathname);
      c.record('forward'); await page!.goForward(); c.assert('forward', 'Forward returns to about', '/about', new URL(page!.url()).pathname);
      await navigate(c); c.record('keyboard', { key: 'Tab' }); await page!.keyboard.press('Tab');
      c.assert('keyboard', 'Tab reaches a focusable element', true, await page!.evaluate(() => ['A', 'BUTTON', 'INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '')));
      c.record('viewport', { width: 360, height: 740 }); await page!.setViewportSize({ width: 360, height: 740 });
      c.assert('responsive', 'Narrow page has no horizontal overflow', true, await page!.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      c.assert('browser-errors', 'No uncaught page errors', 0, c.observations!.errors.length);
      c.assert('failed-http', 'No unexpected HTTP errors in ordinary workflow', 0, c.observations!.network.filter(n => (n.status ?? 200) >= 400 || n.error).length);
      break;
    }
    case 'normal.persistence': {
      await navigate(c); c.record('fill', { selector: '#draft', value: 'Durable synthetic draft' }); await page!.locator('#draft').fill('Durable synthetic draft');
      c.record('click', { selector: '#save-draft' }); await page!.locator('#save-draft').click();
      await page!.locator('#draft-status').filter({ hasText: 'Saved' }).waitFor();
      c.assert('acknowledged', 'The app acknowledges the write', 'Saved', await page!.locator('#draft-status').textContent());
      await refresh(c); c.assert('durable-draft', 'Acknowledged draft survives refresh', 'Durable synthetic draft', await page!.locator('#draft').inputValue()); break;
    }
    case 'chaos.duplicates': {
      await navigate(c); await page!.locator('#note-title').fill('Single logical note'); c.record('fill', { selector: '#note-title', value: 'Single logical note' });
      c.record('double-click', { selector: '#save-note' }); await page!.locator('#save-note').dblclick({ delay: 30 });
      await page!.locator('#note-status').filter({ hasText: 'Saved' }).waitFor();
      await delay(350, undefined, { signal: c.guard.signal });
      const state = await expectedState(c); c.assert('one-record', 'Repeated submission creates exactly one record', 1, state.noteCount);
      c.record('new-tab'); const other = await page!.context().newPage(); await other.goto(c.baseUrl); await other.locator('main[data-ready="true"]').waitFor();
      c.assert('shared-tab', 'Second tab shows authoritative record count', state.noteCount, await other.locator('#notes li').count()); await other.close(); break;
    }
    case 'chaos.boundaries': {
      await navigate(c); c.record('submit-empty'); await page!.locator('#save-note').click();
      c.assert('native-validation', 'Required input rejects empty submission', false, await page!.locator('#note-title').evaluate((element: HTMLInputElement) => element.validity.valid));
      for (const title of ['', 'x'.repeat(81)]) {
        c.record('invalid-request', { titleLength: title.length });
        const response = await c.http.request(`${c.baseUrl}/api/notes`, { method: 'POST', body: { title, operationId: `invalid-${title.length}` } });
        c.assert(`boundary-${title.length}`, 'Server rejects invalid boundary input', 400, response.status);
      }
      c.fixture!.setFaults({ delayMs: 300 }); c.record('inject-delay', { delayMs: 300, fixtureOnly: true });
      // Use a declared operation ID so an interrupted HTTP response can be retried without guessing its outcome.
      const body = { title: 'Interrupted operation', operationId: 'retry-known-operation' };
      c.record('pending-write', body);
      const pending = c.http.request(`${c.baseUrl}/api/notes`, { method: 'POST', body });
      await refresh(c); await pending;
      c.record('retry', { operationId: body.operationId }); await c.http.request(`${c.baseUrl}/api/notes`, { method: 'POST', body });
      const state = await expectedState(c); c.assert('retry-idempotency', 'Retry creates one logical record', 1, state.noteCount);
      await refresh(c); c.assert('ui-consistency', 'UI matches authoritative persisted state', state.noteCount, await page!.locator('#notes li').count()); break;
    }
    case 'hostile.authorization': {
      const policy = await c.http.request(`${c.baseUrl}/api/policy`); c.record('permission-policy', policy.body);
      c.assert('declared-policy', 'A verifiable permission policy is present', FIXTURE_POLICY.permission, recordObject(policy.body).permission);
      c.record('fixture-source', { file: 'src/fixtures/app.ts', handler: 'POST /api/admin/reset', policy: 'FIXTURE_POLICY.permission', driver: 'src/strategies/execute.ts#hostile.authorization' });
      await navigate(c, '/permissions'); await page!.locator('main[data-ready="true"]').waitFor();
      c.record('click', { selector: '#viewer-reset', identity: 'viewer', operation: 'POST /api/admin/reset' });
      await page!.locator('#viewer-reset').click(); await page!.locator('#viewer-status[data-status]').waitFor();
      c.assert('viewer-denied', 'Viewer must be denied server-side', 403, Number(await page!.locator('#viewer-status').getAttribute('data-status')));
      c.assert('no-unauthorized-effect', 'Denied identity must not mutate protected state', 0, (await expectedState(c)).adminActions);
      c.record('click', { selector: '#admin-reset', identity: 'admin', operation: 'POST /api/admin/reset' });
      await page!.locator('#admin-reset').click(); await page!.locator('#admin-status[data-status]').waitFor();
      c.assert('admin-allowed', 'Admin operation is permitted', 200, Number(await page!.locator('#admin-status').getAttribute('data-status'))); break;
    }
    case 'hostile.cost': {
      const policy = recordObject((await c.http.request(`${c.baseUrl}/api/policy`)).body); c.record('simulated-cost-policy', { ceiling: policy.costCeiling, realProviderCalls: 0 });
      for (const operationId of ['cost-a', 'cost-a']) {
        c.record('simulated-ai-request', { operationId, tokens: 60 }); await c.http.request(`${c.baseUrl}/api/ai`, { method: 'POST', body: { operationId, tokens: 60 } });
      }
      c.assert('idempotent-charge', 'Duplicate operation charges only once', 60, (await expectedState(c)).spent);
      c.record('simulated-ai-request', { operationId: 'cost-b', tokens: 60 }); const exceeded = await c.http.request(`${c.baseUrl}/api/ai`, { method: 'POST', body: { operationId: 'cost-b', tokens: 60 } });
      c.assert('ceiling-rejection', 'Over-ceiling request is rejected', 402, exceeded.status);
      const state = await expectedState(c); c.assert('ceiling-enforced', 'Synthetic cost never exceeds the configured ceiling', true, Number(state.spent) <= Number(policy.costCeiling));
      c.assert('quota-counter', 'Accepted billable operation counter remains one', 1, state.costCalls); break;
    }
    case 'siege.bounded': {
      const count = Math.min(8, Math.max(1, c.guard.remaining - 4));
      const lanes = Math.min(2, c.guard.budget.maxConcurrency); let next = 0; const statuses: number[] = [];
      c.record('bounded-burst', { actualRequestsPlanned: count, simulatedEventsPerRequest: 10, concurrency: lanes, rateCap: c.guard.budget.requestsPerSecond });
      await Promise.all(Array.from({ length: lanes }, async () => {
        for (;;) { const index = next++; if (index >= count) return; const response = await c.http.request(`${c.baseUrl}/api/events`, { method: 'POST', body: { eventId: 'duplicate-event', simulatedVolume: 10 } }); statuses.push(response.status); }
      }));
      c.assert('server-errors', 'Bounded event traffic does not cause server errors', 0, statuses.filter(status => status >= 500).length);
      const state = await expectedState(c);
      if (lanes > 1 && c.guard.budget.requestsPerSecond >= 8 && count >= 4) c.assert('throttling', 'Over-capacity fixture rejects some requests', true, statuses.includes(429));
      else c.record('coverage-limitation', 'Configured load is too low to require throttling; only queue bounds and recovery are asserted.');
      c.assert('bounded-queue', 'Queue peak does not exceed declared capacity', true, Number(state.queuePeak) <= FIXTURE_POLICY.queueCapacity);
      c.assert('deduplicated-events', 'Duplicate accepted events are applied once', 1, state.acceptedEvents);
      c.assert('drained-queue', 'Queue drains after load', 0, state.queue);
      await delay(1100, undefined, { signal: c.guard.signal }); c.record('recovery-request', { afterQuietPeriodMs: 1100 });
      const recovery = await c.http.request(`${c.baseUrl}/api/events`, { method: 'POST', body: { eventId: 'recovery-event', simulatedVolume: 1 } });
      c.assert('recovery', 'New work succeeds after quiet period', 200, recovery.status); break;
    }
    case 'breakpoint.recovery': {
      c.fixture!.setFaults({ dependencyDown: true }); c.record('inject-outage', { fixtureOnly: true });
      const outage = await c.http.request(`${c.baseUrl}/api/transfer`, { method: 'POST', body: { amount: 10, operationId: 'outage-op' } });
      c.assert('outage-rejected', 'Dependency outage produces an explicit failure', 503, outage.status);
      c.assert('retry-exhaustion', 'Dependency retries stop at policy limit', 2, recordObject(outage.body).attempts);
      let state = await expectedState(c); c.assert('outage-no-partial-write', 'Rejected operation leaves balance unchanged', 100, state.balance);
      c.assert('retry-counter', 'Actual simulated dependency attempts are bounded', 2, state.dependencyAttempts);
      c.fixture!.setFaults({ dependencyDown: false, dependencyTimeout: true }); c.record('inject-dependency-timeout', { fixtureOnly: true, timeoutPerAttemptMs: 60 });
      const timeout = await c.http.request(`${c.baseUrl}/api/transfer`, { method: 'POST', body: { amount: 10, operationId: 'timeout-op' } });
      c.assert('dependency-timeout', 'Dependency timeout is reported distinctly', 504, timeout.status);
      c.assert('timeout-attempts', 'Dependency timeout retries remain bounded', 2, recordObject(timeout.body).attempts);
      c.assert('timeout-integrity', 'Timed-out operation leaves balance unchanged', 100, (await expectedState(c)).balance);
      c.fixture!.setFaults({ dependencyTimeout: false, failWrite: true }); c.record('restore-dependency-and-fail-write', { fixtureOnly: true });
      const failed = await c.http.request(`${c.baseUrl}/api/transfer`, { method: 'POST', body: { amount: 10, operationId: 'write-op' } });
      c.assert('write-failure', 'Failed write is reported', 503, failed.status);
      state = await expectedState(c); c.assert('write-rollback', 'Failed write leaves balance unchanged', 100, state.balance);
      c.assert('ledger-rollback', 'Failed write leaves ledger unchanged', 0, state.ledger);
      c.fixture!.setFaults({ failWrite: false }); c.record('restore-write-and-concurrent-retry', { concurrentOperations: Math.min(2, c.guard.budget.maxConcurrency), operationId: 'recovery-op' });
      const body = { amount: 10, operationId: 'recovery-op' };
      const requests = Array.from({ length: Math.min(2, c.guard.budget.maxConcurrency) }, () => c.http.request(`${c.baseUrl}/api/transfer`, { method: 'POST', body }));
      const recovered = await Promise.all(requests); c.assert('recovered-status', 'Recovered requests succeed', true, recovered.every(r => r.status === 200));
      state = await expectedState(c); c.assert('single-commit', 'Recovered logical operation commits exactly once', 10, state.ledger);
      c.assert('conservation', 'Balance plus ledger preserves initial value', 100, Number(state.balance) + Number(state.ledger)); break;
    }
    default: throw new Error(`Unknown built-in recipe ${id}`);
  }
}

async function runCustom(scenario: ScenarioDefinition, c: AttemptContext): Promise<void> {
  validateScenario(scenario); const page = c.page!;
  const started = Date.now(); const requestsBefore = c.guard.requests;
  for (const step of scenario.steps) {
    c.guard.check();
    if (Date.now() - started > scenario.budget.maxDurationMs || c.guard.requests - requestsBefore >= scenario.budget.maxRequests) throw new BudgetError('Scenario budget exhausted');
    c.record(step.action, step.action === 'fill' ? { selector: step.selector, value: '[LOCAL INPUT OMITTED]' } : step);
    switch (step.action) {
      case 'navigate': await page.goto(new URL(step.path, c.baseUrl).href, { waitUntil: 'domcontentloaded' }); break;
      case 'fill': await page.locator(step.selector).fill(step.value); break;
      case 'click': await page.locator(step.selector).click({ clickCount: step.count }); break;
      case 'press': await page.keyboard.press(step.key); break;
      case 'reload': await page.reload({ waitUntil: 'domcontentloaded' }); break;
      case 'back': await page.goBack(); break;
      case 'forward': await page.goForward(); break;
      case 'viewport': await page.setViewportSize({ width: step.width, height: step.height }); break;
      case 'wait': await delay(step.ms, undefined, { signal: c.guard.signal }); break;
      case 'assert': c.assertions.push(await evaluateAssertion(scenario.assertions.find(a => a.id === step.assertionId)!, page, c.observations!)); break;
    }
  }
}

const suggestionFor = (category: string): ScenarioResult['remediation'] => ({
  hypothesis: ({ persistence: 'The acknowledgement may precede a durable write.', idempotency: 'Repeated operations may lack a stable key and atomic deduplication.', authorization: 'The server may be trusting client identity without applying the declared permission rule.', 'cost-control': 'Budget reservation and idempotency may not be enforced atomically.', resilience: 'Queue admission, throttling or event deduplication may be missing.', recovery: 'State may be mutated before dependency success or outside a transaction.' } as Record<string, string>)[category] ?? 'Observed behavior differs from the declared assertion; inspect the captured action sequence.',
  suggestion: 'Inspect the failed invariant at the server boundary and use validated, atomic state changes with bounded retries where applicable.',
  verification: 'Replay the failed scenario against the corrected isolated variant and confirm every previously failing assertion passes.', verified: false,
});

export async function executeRun(input: WorkerInput, signal: AbortSignal, emit: WorkerEmit, onBrowserPid: (pid: number) => void): Promise<void> {
  const request = input.request; const target = validateTarget(request.target, input.forbiddenPorts);
  if (request.levels.some(level => level >= 3) && !request.allowFixtureFaults) throw new Error('High-risk fixture execution requires explicit opt-in');
  if (target.kind === 'loopback' && request.levels.some(level => level > 2)) throw new Error('High-risk strategies require engine-owned disposable fixtures');
  const metrics = emptyMetrics(); const guard = new BudgetGuard(request.budget, signal);
  const evidence = new EvidenceStore(input.runId, input.artifactDir, request.budget.maxArtifactBytes, emit);
  let fixture: FixtureHandle | undefined; let browser: BrowserSession | undefined;
  const fixtureDirectory = join(input.artifactDir, 'disposable-fixture');
  let partial = false;
  try {
    await mkdir(input.artifactDir, { recursive: true });
    if (target.kind === 'fixture') fixture = await startFixture({ variant: target.variant, directory: fixtureDirectory });
    const baseUrl = fixture?.baseUrl ?? (target.kind === 'loopback' ? target.baseUrl : '');
    const origins = fixture ? [baseUrl] : target.kind === 'loopback' ? target.approvedOrigins : [];
    browser = new BrowserSession(guard, metrics, origins, input.forbiddenPorts, onBrowserPid);
    const selected = target.kind === 'fixture' ? RECIPES.filter(recipe => request.levels.includes(recipe.level) && (!request.recipeIds || request.recipeIds.includes(recipe.id))) : [];
    const scenarios: Array<Recipe | ScenarioDefinition> = [...selected, ...request.scenarios].sort((a, b) => a.level - b.level);
    const needsBrowser = (scenario: Recipe | ScenarioDefinition): boolean => scenario.level <= 2 || scenario.id === 'hostile.authorization';
    const browserVersion = scenarios.some(needsBrowser) ? await browser.start() : undefined;
    emit({ type: 'ready', environment: { engineVersion: ENGINE_VERSION, nodeVersion: process.version, platform: process.platform, targetKind: target.kind, fixtureVariant: target.kind === 'fixture' ? target.variant : undefined, targetOrigin: new URL(baseUrl).origin, isolated: target.kind === 'fixture', browserVersion } });
    for (const scenario of scenarios) {
      guard.check(); emit({ type: 'progress', message: `Executing ${scenario.id}`, scenarioId: scenario.id });
      const attempts: Attempt[] = []; const evidenceIds: string[] = [];
      const custom = 'safetyPermissions' in scenario && 'cleanup' in scenario && typeof scenario.cleanup === 'string';
      for (let index = 1; index <= 2; index++) {
        if (index === 2 && (attempts[0]?.outcome !== 'failed' || !fixture)) break;
        if (fixture) await fixture.reset();
        const started = performance.now(); const startedAt = new Date().toISOString();
        const actions: Attempt['actions'] = []; const assertions: AssertionOutcome[] = []; const attemptEvidence: string[] = [];
        const httpObservations: HttpObservation[] = [];
        let context: BrowserContext | undefined; let page: Page | undefined; let observations: BrowserObservations | undefined;
        let outcome: Attempt['outcome'] = 'passed'; let error: string | undefined;
        try {
          const contextGuard = custom ? new BudgetGuard((scenario as ScenarioDefinition).budget, signal) : undefined;
          if (needsBrowser(scenario)) ({ context, page, observations } = await browser.context(contextGuard, scenario.evidenceRequirements.includes('trace')));
          const http = new SafeHttp(origins, guard, metrics, httpObservations, input.forbiddenPorts);
          const c: AttemptContext = { page, fixture, baseUrl, guard, http, actions, assertions, observations,
            record(action, details = {}) { actions.push({ at: new Date().toISOString(), action, details }); },
            assert(id, description, expected, observed) { assertions.push({ id, description, expected, observed, passed: JSON.stringify(expected) === JSON.stringify(observed) }); },
          };
          if (custom) await runCustom(scenario as ScenarioDefinition, c); else await runBuiltin(scenario.id, c);
          if (!assertions.length) { outcome = 'inconclusive'; error = 'No explicit assertion executed'; }
          else if (assertions.some(assertion => !assertion.passed)) outcome = 'failed';
          if (observations?.blocked.length) { outcome = 'inconclusive'; partial = true; error = `Network policy or budget blocked requests: ${observations.blocked.join('; ')}`; }
          if (scenario.level === 4) metrics.simulatedEvents += httpObservations.filter(n => n.method === 'POST' && n.path === '/api/events').length * 10 - 9;
        } catch (caught) {
          signal.throwIfAborted();
          error = redactText([...(observations?.blocked ?? []), caught instanceof Error ? caught.message : String(caught)].join('; '));
          outcome = caught instanceof BudgetError || ['SCOPE_BLOCKED', 'BUDGET_EXHAUSTED'].includes(failureCode(error)) ? 'inconclusive' : 'infrastructure_error'; partial = true;
        } finally {
          try {
            if (page && !page.isClosed() && !signal.aborted && scenario.evidenceRequirements.includes('screenshot')) {
              const screenshot = await page.screenshot({ fullPage: false, timeout: 3000, mask: [page.locator('input[type="password"],input[autocomplete="one-time-code"]')] });
              attemptEvidence.push((await evidence.save(scenario.id, index, 'screenshot', screenshot)).id);
            }
            if (context && !signal.aborted && scenario.evidenceRequirements.includes('trace')) {
              const path = join(input.artifactDir, `.trace-${randomUUID()}.zip`);
              await context.tracing.stop({ path }); attemptEvidence.push((await evidence.adoptTrace(scenario.id, index, path)).id);
            }
            attemptEvidence.push((await evidence.save(scenario.id, index, 'actions', { actions, assertions, error })).id);
            attemptEvidence.push((await evidence.save(scenario.id, index, 'network', [...(observations?.network ?? []), ...httpObservations])).id);
            if (observations) attemptEvidence.push((await evidence.save(scenario.id, index, 'console', { messages: observations.console, pageErrors: observations.errors, blocked: observations.blocked })).id);
          } catch (captureError) {
            if (!signal.aborted) { partial = true; outcome = 'infrastructure_error'; error = `Evidence capture failed: ${captureError instanceof Error ? captureError.message : String(captureError)}`; }
          } finally { if (context) await context.close().catch(() => undefined); }
        }
        attempts.push({ index, startedAt, durationMs: performance.now() - started, outcome, assertions, actions, evidenceIds: attemptEvidence, error, ...(error ? { errorCode: failureCode(error) } : {}) });
        evidenceIds.push(...attemptEvidence); emit({ type: 'metrics', metrics });
      }
      const first = attempts[0]!; const second = attempts[1];
      const matchingAssertionIds = second?.outcome === 'failed' ? first.assertions.filter(a => !a.passed && second.assertions.some(b => b.id === a.id && !b.passed)).map(a => a.id) : [];
      const matchingFailure = matchingAssertionIds.length > 0;
      const classification = first.outcome === 'passed' ? 'passed' : first.outcome === 'failed' ? matchingFailure ? 'confirmed' : second ? 'intermittent' : 'suspected' : 'inconclusive';
      const result: ScenarioResult = {
        id: randomUUID(), runId: input.runId, firstObservedAt: first.startedAt,
        scenarioId: scenario.id, version: scenario.version, title: scenario.title, level: scenario.level, category: scenario.category,
        outcome: first.outcome, classification, origin: first.outcome === 'infrastructure_error' ? 'infrastructure' : first.outcome === 'inconclusive' ? 'policy' : 'application',
        severity: first.outcome !== 'failed' || custom ? 'unassigned' : ['authorization', 'cost-control'].includes(scenario.category) ? 'high' : 'medium',
        severityRationale: first.outcome !== 'failed' ? 'No application defect is established by this result.' : custom ? 'Custom assertion failure has no independently defined impact policy; severity remains unassigned.' : ['authorization', 'cost-control'].includes(scenario.category) ? 'The explicit synthetic fixture policy allowed a protected action or exceeded a simulated cost limit. High impact within that fixture contract; no production financial impact is claimed.' : 'A declared data-integrity, idempotency, or bounded-resilience invariant failed in the disposable fixture. Impact is scoped to that demonstrated contract.',
        reproductionSteps: custom ? first.actions.map(a => a.action) : (scenario as Recipe).steps,
        verification: { retested: attempts.length > 1, reproduced: matchingFailure, matchingAssertionIds },
        attempts, evidenceIds, expectedBehavior: scenario.expectedBehavior,
        observedBehavior: first.error ?? (first.assertions.filter(a => !a.passed).map(a => `${a.description}: expected ${JSON.stringify(a.expected)}, observed ${JSON.stringify(a.observed)}`).join('; ') || `${first.assertions.length} explicit assertions passed.`),
        limitations: [...('limitations' in scenario ? scenario.limitations : ['Custom assertions reflect the user-supplied contract.']), ...(fixture ? [] : ['Automatic reproduction is disabled for user-owned applications to avoid repeating mutations.']), ...(scenario.level >= 3 ? ['Synthetic fixture identities, counters and dependency failures; no real provider or billing traffic.'] : []), ...(scenario.level === 4 && (request.budget.maxConcurrency < 2 || request.budget.requestsPerSecond < 8) ? ['Low configured traffic does not establish throttling under overload.'] : [])],
        replayable: !!fixture && scenario.replayable, ...(first.outcome === 'failed' ? { remediation: suggestionFor(scenario.category) } : {}),
      };
      emit({ type: 'result', result });
    }
  } finally {
    try { await browser?.close(); }
    finally {
      try { await fixture?.close(); }
      finally {
        // Cleanup still runs if browser shutdown or an IPC disconnect fails.
        if (fixture) await rm(fixtureDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        emit({ type: 'metrics', metrics });
      }
    }
  }
  emit({ type: 'done', partial });
}
