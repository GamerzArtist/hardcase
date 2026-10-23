import { z } from 'zod';

export const ENGINE_VERSION = '0.1.0';
export const LevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
export type Level = z.infer<typeof LevelSchema>;
export const LEVEL_NAMES = { 1: 'NORMAL', 2: 'CHAOS', 3: 'HOSTILE', 4: 'SIEGE', 5: 'BREAKPOINT' } as const;
export const BudgetSchema = z.strictObject({
  maxDurationMs: z.number().int().min(1000).max(180000).default(120000),
  maxRequests: z.number().int().min(1).max(400).default(300),
  maxConcurrency: z.number().int().min(1).max(4).default(2),
  requestsPerSecond: z.number().int().min(1).max(20).default(10),
  maxArtifactBytes: z.number().int().min(1024).max(67108864).default(33554432),
  maxResponseBytes: z.number().int().min(1024).max(2097152).default(1048576),
});
export type Budget = z.infer<typeof BudgetSchema>;
export const TargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('fixture'), variant: z.enum(['clean', 'faulty']).default('faulty') }),
  z.strictObject({ kind: z.literal('loopback'), baseUrl: z.string().url().max(2048),
    approvedOrigins: z.array(z.string().url().max(2048)).min(1).max(4),
    acknowledgeOwnership: z.literal(true),
  }),
]);
export type Target = z.infer<typeof TargetSchema>;
const selector = z.string().min(1).max(300);
const relativePath = z.string().max(500).regex(/^\/(?!\/)[^\\]*$/, 'Use an origin-relative path');
export const AssertionSchema = z.strictObject({
  id: z.string().regex(/^[a-zA-Z0-9._-]{1,80}$/),
  kind: z.enum(['visible', 'text', 'count', 'value', 'url', 'no_browser_errors']),
  selector: selector.optional(), expected: z.union([z.string().max(2000), z.number(), z.boolean()]).optional(),
  description: z.string().min(1).max(1000),
});
export type AssertionDefinition = z.infer<typeof AssertionSchema>;
export const StepSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('navigate'), path: relativePath }),
  z.strictObject({ action: z.literal('fill'), selector, value: z.string().max(4000) }),
  z.strictObject({ action: z.literal('click'), selector, count: z.number().int().min(1).max(3).default(1) }),
  z.strictObject({ action: z.literal('press'), key: z.enum(['Tab', 'Shift+Tab', 'Enter', 'Escape', 'ArrowDown', 'ArrowUp']) }),
  z.strictObject({ action: z.literal('reload') }),
  z.strictObject({ action: z.literal('back') }),
  z.strictObject({ action: z.literal('forward') }),
  z.strictObject({ action: z.literal('viewport'), width: z.number().int().min(320).max(1920), height: z.number().int().min(480).max(1200) }),
  z.strictObject({ action: z.literal('wait'), ms: z.number().int().min(0).max(1000) }),
  z.strictObject({ action: z.literal('assert'), assertionId: z.string().min(1).max(80) }),
]);
export type Step = z.infer<typeof StepSchema>;
export const ScenarioSchema = z.strictObject({
  id: z.string().regex(/^[a-zA-Z0-9._-]{1,80}$/), version: z.literal(1),
  title: z.string().min(1).max(160), level: z.union([z.literal(1), z.literal(2)]),
  category: z.string().min(1).max(80),
  prerequisites: z.array(z.string().max(300)).max(10).default([]),
  requiredFixtures: z.array(z.string().max(100)).max(5).default([]),
  steps: z.array(StepSchema).min(1).max(40),
  expectedBehavior: z.string().min(1).max(2000),
  assertions: z.array(AssertionSchema).min(1).max(20),
  safetyPermissions: z.array(z.enum(['navigation', 'form-interaction'])).max(2),
  budget: BudgetSchema.default(() => BudgetSchema.parse({})),
  cleanup: z.literal('close-context'),
  evidenceRequirements: z.array(z.enum(['screenshot', 'trace', 'network', 'console'])).min(1).max(4),
  replayable: z.boolean().default(false),
});
export type ScenarioDefinition = z.infer<typeof ScenarioSchema>;
export const CreateRunSchema = z.strictObject({
  target: TargetSchema,
  levels: z.array(LevelSchema).min(1).max(5).default([1, 2]),
  allowFixtureFaults: z.boolean().default(false),
  recipeIds: z.array(z.string().max(80)).max(20).optional(),
  scenarios: z.array(ScenarioSchema).max(10).default([]),
  budget: BudgetSchema.default(() => BudgetSchema.parse({})),
  goals: z.string().max(4000).optional(),
  useAi: z.boolean().default(false),
});
export type CreateRun = z.infer<typeof CreateRunSchema>;
export const RunStateSchema = z.enum(['queued', 'preparing', 'running', 'analyzing', 'completed', 'cancelled', 'timed_out', 'failed', 'partially_completed']);
export type RunState = z.infer<typeof RunStateSchema>;
export const TERMINAL_STATES: RunState[] = ['completed', 'cancelled', 'timed_out', 'failed', 'partially_completed'];
export const isTerminal = (state: RunState): boolean => TERMINAL_STATES.includes(state);
export const TRANSITIONS: Record<RunState, RunState[]> = {
  queued: ['preparing', 'cancelled', 'failed'],
  preparing: ['running', 'cancelled', 'timed_out', 'failed'],
  running: ['analyzing', 'cancelled', 'timed_out', 'failed', 'partially_completed'],
  analyzing: ['completed', 'cancelled', 'timed_out', 'failed', 'partially_completed'],
  completed: [], cancelled: [], timed_out: [], failed: [], partially_completed: [],
};
export const ClassificationSchema = z.enum(['confirmed', 'intermittent', 'suspected', 'inconclusive', 'passed']);
export const EvidenceSchema = z.strictObject({
  id: z.string(), runId: z.string(), scenarioId: z.string(), attempt: z.number().int(),
  kind: z.enum(['screenshot', 'trace', 'actions', 'network', 'console']),
  relativePath: z.string(), mediaType: z.string(), bytes: z.number().int().nonnegative(),
  sha256: z.string(), sensitive: z.boolean(), createdAt: z.string(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;
export const AssertionOutcomeSchema = z.strictObject({
  id: z.string(), description: z.string(), passed: z.boolean(), expected: z.unknown(), observed: z.unknown(),
});
export type AssertionOutcome = z.infer<typeof AssertionOutcomeSchema>;
export const AttemptSchema = z.strictObject({
  index: z.number().int(), startedAt: z.string(), durationMs: z.number().nonnegative(),
  outcome: z.enum(['passed', 'failed', 'inconclusive', 'infrastructure_error']),
  assertions: z.array(AssertionOutcomeSchema),
  actions: z.array(z.strictObject({ at: z.string(), action: z.string(), details: z.unknown() })),
  evidenceIds: z.array(z.string()), error: z.string().optional(), errorCode: z.string().optional(),
});
export type Attempt = z.infer<typeof AttemptSchema>;
export const ScenarioResultSchema = z.strictObject({
  id: z.string(), runId: z.string(), firstObservedAt: z.string(),
  scenarioId: z.string(), version: z.number().int(), title: z.string(), level: LevelSchema, category: z.string(),
  outcome: z.enum(['passed', 'failed', 'inconclusive', 'skipped', 'blocked', 'infrastructure_error']),
  classification: ClassificationSchema,
  origin: z.enum(['application', 'infrastructure', 'policy']),
  severity: z.enum(['info', 'low', 'medium', 'high', 'critical', 'unassigned']),
  severityRationale: z.string(), reproductionSteps: z.array(z.string()),
  verification: z.strictObject({ retested: z.boolean(), reproduced: z.boolean(), matchingAssertionIds: z.array(z.string()) }),
  attempts: z.array(AttemptSchema), evidenceIds: z.array(z.string()),
  expectedBehavior: z.string(), observedBehavior: z.string(),
  limitations: z.array(z.string()), replayable: z.boolean(),
  remediation: z.strictObject({ hypothesis: z.string(), suggestion: z.string(), verification: z.string(), verified: z.literal(false) }).optional(),
});
export type ScenarioResult = z.infer<typeof ScenarioResultSchema>;
export const MetricsSchema = z.strictObject({
  actualNetworkRequests: z.number().int().nonnegative(), simulatedEvents: z.number().int().nonnegative(),
  failedRequests: z.number().int().nonnegative(), serverErrors: z.number().int().nonnegative(),
  rejectedRequests: z.number().int().nonnegative(), blockedRequests: z.number().int().nonnegative(),
  latencyMs: z.array(z.number().nonnegative()),
});
export type Metrics = z.infer<typeof MetricsSchema>;
export const emptyMetrics = (): Metrics => ({ actualNetworkRequests: 0, simulatedEvents: 0, failedRequests: 0, serverErrors: 0, rejectedRequests: 0, blockedRequests: 0, latencyMs: [] });
export const EnvironmentSchema = z.strictObject({
  engineVersion: z.string(), nodeVersion: z.string(), platform: z.string(),
  browserVersion: z.string().optional(), targetKind: z.string(), fixtureVariant: z.string().optional(),
  targetOrigin: z.string().optional(), isolated: z.boolean(),
});
export type Environment = z.infer<typeof EnvironmentSchema>;
export const AiAnalysisSchema = z.strictObject({
  status: z.enum(['disabled', 'completed', 'unavailable', 'failed']),
  explanation: z.string(), suggestions: z.array(z.string()),
  proposedScenarios: z.array(ScenarioSchema),
  requests: z.number().int().nonnegative(),
});
export type AiAnalysis = z.infer<typeof AiAnalysisSchema>;
export const RunSchema = z.strictObject({
  id: z.string(), state: RunStateSchema, createdAt: z.string(), updatedAt: z.string(),
  startedAt: z.string().nullable(), finishedAt: z.string().nullable(),
  request: CreateRunSchema, results: z.array(ScenarioResultSchema), evidence: z.array(EvidenceSchema),
  metrics: MetricsSchema, environment: EnvironmentSchema.nullable(),
  error: z.string().nullable(), errorCode: z.string().optional(), replayOf: z.string().nullable(),
  ai: AiAnalysisSchema, revision: z.number().int().nonnegative(),
  progress: z.strictObject({ totalScenarios: z.number().int().nonnegative(), completedScenarios: z.number().int().nonnegative(), currentScenarioId: z.string().nullable(), percent: z.number().min(0).max(100) }),
});
export type Run = z.infer<typeof RunSchema>;
export const EventSchema = z.strictObject({
  id: z.number().int(), runId: z.string(), at: z.string(),
  type: z.enum(['state', 'scenario', 'progress', 'evidence', 'warning']),
  data: z.record(z.string(), z.unknown()),
});
export type RunEvent = z.infer<typeof EventSchema>;
export interface Recipe {
  id: string; version: 1 | 2; title: string; level: Level; category: string;
  targetKinds: Array<Target['kind']>; prerequisites: string[]; requiredFixtures: string[];
  steps: string[]; expectedBehavior: string; assertions: string[];
  safetyPermissions: string[]; budget: Partial<Budget>; cleanup: string[];
  evidenceRequirements: string[]; replayable: boolean; limitations: string[];
}
export type WorkerInput = { runId: string; request: CreateRun; artifactDir: string; forbiddenPorts: number[] };
export type WorkerMessage =
  | { type: 'heartbeat' }
  | { type: 'browser'; pid: number }
  | { type: 'ready'; environment: Environment }
  | { type: 'progress'; message: string; scenarioId?: string }
  | { type: 'evidence'; evidence: Evidence }
  | { type: 'result'; result: ScenarioResult }
  | { type: 'metrics'; metrics: Metrics }
  | { type: 'done'; partial: boolean }
  | { type: 'error'; message: string };
export type WorkerEmit = (message: WorkerMessage) => void;
