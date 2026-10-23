import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright';
import { startReviewboard, DEMO_PASSWORD } from './server.mjs';
import { createEngine } from '../../dist/api/server.js';
import { isTerminal } from '../../dist/domain/models.js';

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const root = resolve(process.env.REVIEWBOARD_VERIFY_DIR ?? `.engine/reviewboard/${stamp}`);
const proofDir = join(root, 'reviewed-evidence');
await mkdir(proofDir, { recursive: true });
const verification = { at: new Date().toISOString(), root, aiEnabled: false, target: 'Standalone Reviewboard MVP, synthetic local accounts', runs: [], passed: false };
let target, browser, engine;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  const scenarios = await Promise.all(['viewer-status', 'editor-persistence', 'login-recovery'].map(async name => JSON.parse(await readFile(new URL(`./scenarios/${name}.json`, import.meta.url), 'utf8'))));
  verification.sourceHashes = await Promise.all(['server.mjs', 'public/app.js', 'public/index.html', 'public/styles.css', 'verify.mjs', ...['viewer-status', 'editor-persistence', 'login-recovery'].map(n => `scenarios/${n}.json`)].map(async path => ({ path: `examples/reviewboard/${path}`, sha256: hash(await readFile(new URL(path, import.meta.url))) })));

  // Inspect the real app as a user before asking Hardcase to assess it.
  target = await startReviewboard({ port: 0, dataDir: join(root, 'manual-ui'), mode: 'clean' });
  const port = Number(new URL(target.origin).port);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(target.origin);
  await page.locator('#username').fill('alex'); await page.locator('#password').fill('wrong-password');
  const invalidResponse = page.waitForResponse(r => r.url().endsWith('/api/login'));
  await page.locator('#sign-in').click(); assert.equal((await invalidResponse).status(), 401);
  await page.locator('#login-error').filter({ hasText: 'Username or password is incorrect.' }).waitFor();
  await page.locator('#password').fill(DEMO_PASSWORD); await page.locator('#sign-in').click();
  await page.locator('#new-task').fill('Write the owner review notes'); await page.locator('#add-task').click();
  await page.locator('#complete-3').click(); await page.locator('#state-3').filter({ hasText: 'Done' }).waitFor();
  await page.reload(); await page.locator('#state-3').filter({ hasText: 'Done' }).waitFor();
  await page.screenshot({ path: join(proofDir, 'mvp-editor-desktop.png'), fullPage: true });
  await page.locator('#sign-out').click(); await page.locator('#username').fill('jamie'); await page.locator('#password').fill(DEMO_PASSWORD); await page.locator('#sign-in').click();
  const deniedResponse = page.waitForResponse(r => r.request().method() === 'PATCH');
  await page.locator('#complete-1').click(); assert.equal((await deniedResponse).status(), 403);
  await page.locator('#action-status').filter({ hasText: 'Viewers cannot change task status.' }).waitFor();
  const security = await page.evaluate(async () => {
    const create = await fetch('/api/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Not allowed' }) });
    await fetch('/api/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const afterLogout = await fetch('/api/tasks');
    return { viewerCreateStatus: create.status, afterLogoutStatus: afterLogout.status };
  });
  assert.deepEqual(security, { viewerCreateStatus: 403, afterLogoutStatus: 401 });
  await page.reload(); await page.locator('#username').fill('jamie'); await page.locator('#password').fill(DEMO_PASSWORD); await page.locator('#sign-in').click();
  await page.locator('#complete-1').click(); await page.locator('#action-status').filter({ hasText: 'Viewers cannot change task status.' }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: join(proofDir, 'mvp-viewer-mobile.png'), fullPage: true });
  assert.deepEqual(pageErrors, []);
  verification.manualBrowser = { browserVersion: browser.version(), invalidLoginStatus: 401, viewerUpdateStatus: 403, ...security, editorPersistence: true, mobileNoHorizontalOverflow: true, pageErrors, screenshots: ['mvp-editor-desktop.png', 'mvp-viewer-mobile.png'] };
  await browser.close(); browser = null; await target.close(); target = null;

  engine = await createEngine({ dataDir: join(root, 'engine'), port: 0, logger: false });
  const origin = await engine.listen();
  const request = async (path, body, expectedStatus = 200) => {
    const response = await fetch(`${origin}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${engine.token}`, 'content-type': 'application/json', ...(path === '/v1/runs' ? { 'idempotency-key': randomUUID() } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json(); assert.equal(response.status, expectedStatus, `${path}: ${JSON.stringify(data)}`); return data;
  };
  verification.readiness = await request('/v1/ready');
  for (const scenario of scenarios) await request('/v1/scenarios/validate', scenario);
  const completed = [];
  for (const phase of ['faulty', 'faulty-reproduction', 'clean']) {
    target = await startReviewboard({ port, dataDir: join(root, phase), mode: phase === 'clean' ? 'clean' : 'faulty' });
    const selected = phase === 'faulty-reproduction' ? [scenarios[0]] : scenarios;
    const created = await request('/v1/runs', { target: { kind: 'loopback', baseUrl: target.origin, approvedOrigins: [target.origin], acknowledgeOwnership: true }, levels: [1], scenarios: selected, useAi: false }, 202);
    let run; const deadline = Date.now() + 190000;
    do { await delay(200); run = await request(`/v1/runs/${created.id}`); } while ((!isTerminal(run.state) || engine.manager.activeCount) && Date.now() < deadline);
    const folder = join(proofDir, phase); await mkdir(folder, { recursive: true });
    const report = await request(`/v1/runs/${run.id}/report`); await writeFile(join(folder, 'report.json'), JSON.stringify(report, null, 2));
    const markdown = await fetch(`${origin}/v1/runs/${run.id}/report?format=markdown`, { headers: { authorization: `Bearer ${engine.token}` } });
    await writeFile(join(folder, 'report.md'), await markdown.text());
    const artifacts = [];
    for (const artifact of run.evidence) {
      if (artifact.kind === 'trace') continue; // Raw traces contain session cookies; retain them only in private engine storage.
      const response = await fetch(`${origin}/v1/runs/${run.id}/evidence/${artifact.id}`, { headers: { authorization: `Bearer ${engine.token}` } });
      assert.equal(response.status, 200); const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(hash(bytes), artifact.sha256); assert.equal(bytes.length, artifact.bytes);
      await writeFile(join(folder, artifact.relativePath), bytes); artifacts.push({ ...artifact, exportedPath: `${phase}/${artifact.relativePath}` });
    }
    await target.close(); target = null;
    const db = new DatabaseSync(join(root, phase, 'reviewboard.sqlite'), { readOnly: true });
    const databaseTasks = db.prepare('SELECT id, title, state, version FROM tasks ORDER BY id').all(); db.close();
    const entry = { phase, runId: run.id, state: run.state, browser: run.environment?.browserVersion, targetOrigin: run.environment?.targetOrigin, results: run.results.map(r => ({ scenarioId: r.scenarioId, findingId: r.id, classification: r.classification, outcome: r.outcome, failedAssertions: r.attempts[0]?.assertions.filter(a => !a.passed), error: r.attempts[0]?.error })), requests: run.metrics.actualNetworkRequests, artifacts, databaseTasks };
    verification.runs.push(entry); completed.push(run);
    console.log(JSON.stringify({ phase, runId: run.id, state: run.state, results: entry.results }));
    assert.equal(run.state, 'completed');
    const permission = run.results.find(r => r.scenarioId === 'reviewboard.viewer-status');
    assert.equal(permission.classification, phase === 'clean' ? 'passed' : 'suspected');
    assert.equal(permission.origin, 'application');
    assert.equal(databaseTasks.find(t => t.id === 1).state, phase === 'clean' ? 'Todo' : 'Done');
    for (const result of run.results.filter(r => r.scenarioId !== permission.scenarioId)) assert.equal(result.classification, 'passed');
  }
  const failedIds = run => run.results[0].attempts[0].assertions.filter(a => !a.passed).map(a => a.id);
  assert.deepEqual(failedIds(completed[0]), failedIds(completed[1]));
  verification.reproduction = { method: 'Second explicit authorized run against a fresh standalone database; no automatic loopback replay', matchingAssertionIds: failedIds(completed[0]), engineClassificationRetained: 'suspected' };
  const replay = await request(`/v1/runs/${completed[0].id}/replay`, { scenarioIds: ['reviewboard.viewer-status'] }, 409);
  verification.loopbackReplayRestriction = { status: 409, preserved: true, response: replay };
  verification.comparison = await request('/v1/compare', { before: completed[0].id, after: completed[2].id });
  verification.passed = true;
} catch (error) { verification.error = String(error); process.exitCode = 1; console.error(String(error)); }
finally {
  if (browser) await browser.close(); if (target) await target.close(); if (engine) await engine.close();
  await writeFile(join(proofDir, 'verification.json'), JSON.stringify(verification, null, 2));
  console.log(`Reviewboard evidence: ${proofDir}`);
}
