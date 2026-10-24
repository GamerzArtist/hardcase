// Actual packaged WebView2 acceptance. Debugging is enabled for this process only,
// never in the shipped app configuration. Does not mock engine responses.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';

const executable = resolve(process.argv[2] ?? 'apps/web/src-tauri/target/release/hardcase.exe');
const output = resolve(process.argv[3] ?? `.engine/desktop-qa/${new Date().toISOString().replace(/[:.]/g, '-')}`);
await mkdir(output, { recursive: true });
const port = Number(process.env.HARDCASE_QA_CDP_PORT ?? 9431);
const child = spawn(executable, [], { cwd: dirname(executable), windowsHide: false, stdio: 'ignore', env: {
  ...process.env,
  WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`,
  WEBVIEW2_USER_DATA_FOLDER: join(output, 'webview-profile'),
} });
let spawnError;
child.on('error', error => { spawnError = error; });
const exit = new Promise(ok => child.once('exit', code => ok(code)));
const verification = { passed: false, at: new Date().toISOString(), executable, executableSha256: createHash('sha256').update(await readFile(executable)).digest('hex'), checks: {}, screenshots: [], runIds: [], pageErrors: [] };
let browser, page;
async function capture(name) {
  await page.screenshot({ path: join(output, name), fullPage: true });
  verification.screenshots.push(name);
}
async function closeWindow() {
  if (child.exitCode !== null || !child.pid) return;
  const closer = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$p = Get-Process -Id ${child.pid} -ErrorAction SilentlyContinue; if ($p) { $null = $p.CloseMainWindow() }`], { windowsHide: true, stdio: 'ignore' });
  await new Promise(ok => closer.once('exit', ok));
  await Promise.race([exit, delay(15000)]);
}
try {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`Desktop exited during startup: ${child.exitCode}`);
    try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {}
    await delay(250);
  }
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0];
  page = context.pages()[0] ?? await context.waitForEvent('page');
  page.on('pageerror', error => verification.pageErrors.push(error.message));
  page.setDefaultTimeout(20000);
  verification.webviewVersion = browser.version();
  await expect(page.getByText('Engine connected', { exact: true })).toBeVisible({ timeout: 45000 });
  await expect(page.getByRole('heading', { name: 'Start a new test', exact: true })).toBeVisible();
  verification.checks.nativeBootstrap = true;
  await capture('desktop-prepare.png');
  await page.getByLabel('Fixture variant').selectOption('faulty');
  await page.getByRole('radio').nth(4).check();
  await page.getByRole('checkbox', { name: /Allow fault injection/ }).check();
  const created = page.waitForResponse(r => r.request().method() === 'POST' && /\/v1\/runs$/.test(r.url()));
  await page.getByRole('button', { name: 'Run test', exact: true }).click();
  const started = await (await created).json();
  verification.runIds.push(started.id);
  await expect(page.locator('.run-summary .status')).toHaveText('Completed', { timeout: 120000 });
  await expect(page.locator('.scenario-row')).toHaveCount(8);
  verification.checks.actualFiveTierRun = true;
  await capture('desktop-observe.png');
  await page.getByRole('button', { name: 'Investigate', exact: true }).first().click();
  await expect(page.locator('.finding-item')).toHaveCount(7);
  await page.getByRole('button', { name: /Acknowledged draft survives reload/ }).click();
  await expect(page.getByText('Reproduced on retest', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  await page.locator('.artifact-select').filter({ hasText: 'screenshot' }).first().click();
  await expect(page.locator('.artifact-preview img')).toBeVisible();
  await expect.poll(() => page.locator('.artifact-preview img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  verification.checks.authenticatedScreenshot = true;
  await capture('desktop-evidence.png');
  const download = page.waitForEvent('download', { timeout: 20000 });
  await page.getByRole('button', { name: 'JSON report', exact: true }).click();
  const reportDownload = await download;
  await reportDownload.saveAs(join(output, 'report.json'));
  const report = JSON.parse(await readFile(join(output, 'report.json'), 'utf8'));
  assert.equal(report.run.id, started.id);
  assert.equal(report.summary.confirmed, 7);
  verification.checks.reportExport = true;
  await page.getByRole('button', { name: 'Reproduce', exact: true }).click();
  await expect(page.locator('.reproduction-text')).toHaveValue(/Expected:/);
  const replayed = page.waitForResponse(r => r.request().method() === 'POST' && /\/replay$/.test(r.url()));
  await page.getByRole('button', { name: 'Replay in a fresh fixture', exact: true }).click();
  verification.runIds.push((await (await replayed).json()).id);
  await expect(page.locator('.run-summary .status')).toHaveText('Completed', { timeout: 60000 });
  await expect(page.locator('.scenario-row')).toHaveCount(1);
  verification.checks.replay = true;
  await page.getByRole('button', { name: /Run history/ }).first().click();
  await expect(page.locator('.history-row')).not.toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Engine connected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Run history/ }).first().click();
  await expect(page.locator('.history-row')).not.toHaveCount(0);
  verification.checks.reloadHistory = true;
  assert.deepEqual(verification.pageErrors, []);
  await closeWindow();
  assert.equal(child.exitCode, 0, 'Native window must close the engine and exit cleanly.');
  verification.checks.nativeShutdown = true;
  verification.passed = true;
} catch (error) {
  verification.error = error.message;
  if (page) { await capture('desktop-failure.png').catch(() => {}); }
  process.exitCode = 1;
} finally {
  await closeWindow();
  await browser?.close().catch(() => {});
  if (child.exitCode === null && child.pid) child.kill();
  await writeFile(join(output, 'verification.json'), JSON.stringify(verification, null, 2));
  console.log(JSON.stringify({ ...verification, output }, null, 2));
}
