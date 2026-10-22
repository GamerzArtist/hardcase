import { mkdir, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { RunSchema, LEVEL_NAMES, type Run, type ScenarioResult } from '../domain/models.js';
import { redact, redactText } from '../security/redact.js';
import { RECIPES } from '../strategies/catalog.js';

export const RegressionSchema = z.strictObject({ before: z.string(), after: z.string(), changes: z.array(z.strictObject({ scenarioId: z.string(), before: z.string(), after: z.string(), change: z.enum(['not_comparable', 'resolved_in_this_run', 'regression', 'unchanged', 'changed']) })) });
export const ReportSchema = z.strictObject({
  schemaVersion: z.literal(1), generatedAt: z.string(), disclaimer: z.string(),
  run: RunSchema,
  summary: z.strictObject({ tested: z.number(), passed: z.number(), confirmed: z.number(), intermittent: z.number(), suspected: z.number(), inconclusive: z.number(), skipped: z.number(), blocked: z.number(), infrastructureErrors: z.number(), unexecuted: z.array(z.string()) }),
  coverage: z.array(z.strictObject({ level: z.number(), name: z.string(), scenarioIds: z.array(z.string()), mode: z.string() })),
  reproduction: z.array(z.strictObject({ scenarioId: z.string(), eligible: z.boolean(), instructions: z.string() })),
  artifactPrivacy: z.string(),
  regressionComparison: RegressionSchema.nullable(),
});
export type Report = z.infer<typeof ReportSchema>;
export function sanitizedRun(run: Run): Run {
  const copy = structuredClone(run);
  copy.request.goals = copy.request.goals ? '[Local application goals omitted from exported data]' : undefined;
  if (copy.request.target.kind === 'loopback') copy.request.target.baseUrl = new URL(copy.request.target.baseUrl).origin;
  for (const scenario of copy.request.scenarios) for (const step of scenario.steps) if (step.action === 'fill') step.value = '[Local input omitted]';
  // AI suggestions are not evidence. Generic redaction may replace nested free-form fields only.
  return redact(copy) as Run;
}
export function makeReport(run: Run, baseline?: Run): Report {
  const completedIds = new Set(run.results.map(r => r.scenarioId));
  const plannedIds = [...(run.request.target.kind === 'fixture' ? RECIPES.filter(r => run.request.levels.includes(r.level) && (!run.request.recipeIds || run.request.recipeIds.includes(r.id))).map(r => r.id) : []), ...run.request.scenarios.map(s => s.id)];
  const count = (classification: ScenarioResult['classification']): number => run.results.filter(r => r.classification === classification).length;
  return {
    schemaVersion: 1, generatedAt: new Date().toISOString(), disclaimer: 'This report covers only the executed scenarios and declared assertions. Passing does not establish that the application is safe, secure, or bug-free.',
    run: sanitizedRun(run), summary: { tested: run.results.length, passed: count('passed'), confirmed: count('confirmed'), intermittent: count('intermittent'), suspected: count('suspected'), inconclusive: count('inconclusive'), skipped: run.results.filter(r => r.outcome === 'skipped').length, blocked: run.results.filter(r => r.outcome === 'blocked').length, infrastructureErrors: run.results.filter(r => r.origin === 'infrastructure').length, unexecuted: plannedIds.filter(id => !completedIds.has(id)) },
    coverage: run.request.levels.map(level => ({ level, name: LEVEL_NAMES[level], scenarioIds: run.results.filter(r => r.level === level).map(r => r.scenarioId), mode: level >= 3 ? 'Real local HTTP execution against synthetic fixture policy and fault controls' : 'Real Chromium browser execution' })),
    reproduction: run.results.map(result => ({ scenarioId: result.scenarioId, eligible: result.replayable, instructions: result.replayable ? `POST /v1/runs/${run.id}/replay with {"scenarioIds":["${result.scenarioId}"]}. A fresh disposable fixture of the same variant is created.` : 'Use the stored local scenario and explicitly authorize a new run; automatic replay is unavailable for this target.' })),
    artifactPrivacy: 'Action and metadata JSON are redacted. Screenshots and traces can contain sensitive page data and are local-only, authenticated artifacts; raw traces cannot be reliably redacted automatically.',
    regressionComparison: baseline ? compareRuns(baseline, run) : null,
  };
}
const md = (text: string): string => redactText(text).replace(/[|<>]/g, character => ({ '|': '\\|', '<': '&lt;', '>': '&gt;' })[character]!).replace(/\r?\n/g, ' ');
export function markdownReport(report: Report): string {
  const { run, summary } = report;
  const lines = [`# Application testing report`, '', `Run: ${run.id}  `, `State: **${run.state}**  `, `Engine: ${run.environment?.engineVersion ?? 'unknown'}  `, '', report.disclaimer, '',
    `Executed ${summary.tested} scenarios: ${summary.passed} passed, ${summary.confirmed} confirmed, ${summary.intermittent} intermittent, ${summary.suspected} suspected, ${summary.inconclusive} inconclusive.`, '',
    `Actual network requests: ${run.metrics.actualNetworkRequests}. Simulated event units: ${run.metrics.simulatedEvents}. Server errors: ${run.metrics.serverErrors}; rejected responses: ${run.metrics.rejectedRequests}. These counts measure different things.`, '',
    `Environment: ${md(JSON.stringify(run.environment))}`, '', '## Coverage', '', '| Level | Execution | Scenarios |', '|---|---|---|',
    ...report.coverage.map(item => `| ${item.level} ${item.name} | ${item.mode} | ${item.scenarioIds.join(', ') || 'Not executed'} |`), '', '## Findings', '',
  ];
  for (const result of run.results) {
    lines.push(`### ${md(result.title)}`, '', `Level ${result.level}; **${result.classification}**; outcome ${result.outcome}; severity ${result.severity}; source ${result.origin}.`, '', `Expected: ${md(result.expectedBehavior)}`, '', `Observed: ${md(result.observedBehavior)}`, '', `Attempts: ${result.attempts.length}. Evidence: ${result.evidenceIds.join(', ') || 'none'}.`, '');
    lines.push(`Severity rationale: ${md(result.severityRationale)}`, '', `Verified reproduction: ${result.verification.reproduced ? 'yes' : 'no'}; retested: ${result.verification.retested ? 'yes' : 'no'}.`, '');
    for (const attempt of result.attempts) lines.push(`Attempt ${attempt.index}: ${attempt.outcome}, ${Math.round(attempt.durationMs)} ms; ${attempt.assertions.filter(a => a.passed).length}/${attempt.assertions.length} assertions passed.`, '');
    if (result.remediation) lines.push(`Hypothesized cause: ${md(result.remediation.hypothesis)}`, '', `Suggested remediation (unverified): ${md(result.remediation.suggestion)}`, '', `Required verification: ${md(result.remediation.verification)}`, '');
    lines.push(`Reproduce: ${report.reproduction.find(r => r.scenarioId === result.scenarioId)!.instructions}`, '', `Limitations: ${result.limitations.map(md).join(' ')}`, '');
  }
  lines.push('## Incomplete coverage', '', `Unexecuted: ${summary.unexecuted.join(', ') || 'none'}. Skipped: ${summary.skipped}. Blocked: ${summary.blocked}. Infrastructure errors: ${summary.infrastructureErrors}.`, '', `Run error: ${run.error ? md(run.error) : 'none'}`, '', '## AI', '', `Status: ${run.ai.status}. ${md(run.ai.explanation)}`, '', '## Artifact privacy', '', report.artifactPrivacy, '');
  if (report.regressionComparison) lines.push('## Regression comparison', '', `Baseline: ${report.regressionComparison.before}`, '', '| Scenario | Before | After | Change |', '|---|---|---|---|', ...report.regressionComparison.changes.map(change => `| ${md(change.scenarioId)} | ${change.before} | ${change.after} | ${change.change} |`), '');
  return lines.join('\n');
}
export async function saveReports(run: Run, directory: string, baseline?: Run): Promise<void> {
  await mkdir(directory, { recursive: true }); const report = makeReport(run, baseline);
  for (const [name, content] of [['report.json', JSON.stringify(report, null, 2)], ['report.md', markdownReport(report)]]) {
    const path = join(directory, name!); const temporary = `${path}.tmp`;
    await writeFile(temporary, content!, { mode: 0o600 }); await rename(temporary, path);
  }
}
export function comparisonKey(run: Run): string {
  return createHash('sha256').update(JSON.stringify({ target: run.request.target.kind === 'fixture' ? 'notes-fixture-v1' : run.request.target,
    levels: [...run.request.levels].sort(), recipeIds: run.request.recipeIds?.slice().sort() ?? null,
    scenarios: run.request.scenarios, budget: run.request.budget, engine: run.environment?.engineVersion })).digest('hex');
}
export function compareRuns(before: Run, after: Run): z.infer<typeof RegressionSchema> {
  if (comparisonKey(before) !== comparisonKey(after)) throw new Error('Runs are incompatible: target contract, engine, scenarios, levels, and budgets must match');
  const ids = [...new Set([...before.results, ...after.results].map(r => r.scenarioId))];
  return { before: before.id, after: after.id, changes: ids.map(scenarioId => {
    const a = before.results.find(r => r.scenarioId === scenarioId); const b = after.results.find(r => r.scenarioId === scenarioId);
    const change = !a || !b ? 'not_comparable' : a.classification !== 'passed' && b.classification === 'passed' ? 'resolved_in_this_run' : a.classification === 'passed' && b.classification !== 'passed' ? 'regression' : a.classification === b.classification ? 'unchanged' : 'changed';
    return { scenarioId, before: a?.classification ?? 'unexecuted', after: b?.classification ?? 'unexecuted', change };
  }) };
}
