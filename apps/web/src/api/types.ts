import { z } from "zod";

export const LEVEL_NAMES = {
	1: "NORMAL",
	2: "CHAOS",
	3: "HOSTILE",
	4: "SIEGE",
	5: "BREAKPOINT",
} as const;
export const LevelSchema = z.union([
	z.literal(1),
	z.literal(2),
	z.literal(3),
	z.literal(4),
	z.literal(5),
]);
export type Level = z.infer<typeof LevelSchema>;
export const RunStateSchema = z.enum([
	"queued",
	"preparing",
	"running",
	"analyzing",
	"completed",
	"cancelled",
	"timed_out",
	"failed",
	"partially_completed",
]);
export type RunState = z.infer<typeof RunStateSchema>;
export const isTerminal = (state: RunState): boolean =>
	[
		"completed",
		"cancelled",
		"timed_out",
		"failed",
		"partially_completed",
	].includes(state);
export const TargetSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("fixture"),
		variant: z.enum(["clean", "faulty"]),
	}),
	z.object({
		kind: z.literal("loopback"),
		baseUrl: z.string(),
		approvedOrigins: z.array(z.string()),
		acknowledgeOwnership: z.literal(true),
	}),
]);
export type Target = z.infer<typeof TargetSchema>;
export const BudgetSchema = z.object({
	maxDurationMs: z.number(),
	maxRequests: z.number(),
	maxConcurrency: z.number(),
	requestsPerSecond: z.number(),
	maxArtifactBytes: z.number(),
	maxResponseBytes: z.number(),
});
export type Budget = z.infer<typeof BudgetSchema>;
export const AssertionDefinitionSchema = z.object({
	id: z.string(),
	kind: z.enum([
		"visible",
		"text",
		"count",
		"value",
		"url",
		"no_browser_errors",
	]),
	selector: z.string().optional(),
	expected: z.union([z.string(), z.number(), z.boolean()]).optional(),
	description: z.string(),
});
export const StepSchema = z.discriminatedUnion("action", [
	z.object({ action: z.literal("navigate"), path: z.string() }),
	z.object({
		action: z.literal("fill"),
		selector: z.string(),
		value: z.string(),
	}),
	z.object({
		action: z.literal("click"),
		selector: z.string(),
		count: z.number().default(1),
	}),
	z.object({
		action: z.literal("press"),
		key: z.enum([
			"Tab",
			"Shift+Tab",
			"Enter",
			"Escape",
			"ArrowDown",
			"ArrowUp",
		]),
	}),
	z.object({ action: z.literal("reload") }),
	z.object({ action: z.literal("back") }),
	z.object({ action: z.literal("forward") }),
	z.object({
		action: z.literal("viewport"),
		width: z.number(),
		height: z.number(),
	}),
	z.object({ action: z.literal("wait"), ms: z.number() }),
	z.object({ action: z.literal("assert"), assertionId: z.string() }),
]);
export const ScenarioSchema = z.object({
	id: z.string(),
	version: z.literal(1),
	title: z.string(),
	level: z.union([z.literal(1), z.literal(2)]),
	category: z.string(),
	prerequisites: z.array(z.string()),
	requiredFixtures: z.array(z.string()),
	steps: z.array(StepSchema),
	expectedBehavior: z.string(),
	assertions: z.array(AssertionDefinitionSchema),
	safetyPermissions: z.array(z.enum(["navigation", "form-interaction"])),
	budget: BudgetSchema,
	cleanup: z.literal("close-context"),
	evidenceRequirements: z.array(
		z.enum(["screenshot", "trace", "network", "console"]),
	),
	replayable: z.boolean(),
});
export type ScenarioDefinition = z.infer<typeof ScenarioSchema>;
export const CreateRunSchema = z.object({
	target: TargetSchema,
	levels: z.array(LevelSchema),
	allowFixtureFaults: z.boolean().default(false),
	recipeIds: z.array(z.string()).optional(),
	scenarios: z.array(ScenarioSchema),
	budget: BudgetSchema,
	goals: z.string().optional(),
	useAi: z.boolean(),
});
export type CreateRun = z.infer<typeof CreateRunSchema>;
export const EvidenceSchema = z.object({
	id: z.string(),
	runId: z.string(),
	scenarioId: z.string(),
	attempt: z.number(),
	kind: z.enum(["screenshot", "trace", "actions", "network", "console"]),
	relativePath: z.string(),
	mediaType: z.string(),
	bytes: z.number(),
	sha256: z.string(),
	sensitive: z.boolean(),
	createdAt: z.string(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;
const AttemptSchema = z.object({
	index: z.number(),
	startedAt: z.string(),
	durationMs: z.number(),
	outcome: z.enum(["passed", "failed", "inconclusive", "infrastructure_error"]),
	assertions: z.array(
		z.object({
			id: z.string(),
			description: z.string(),
			passed: z.boolean(),
			expected: z.unknown(),
			observed: z.unknown(),
		}),
	),
	actions: z.array(
		z.object({ at: z.string(), action: z.string(), details: z.unknown() }),
	),
	evidenceIds: z.array(z.string()),
	error: z.string().optional(),
});
export const ScenarioResultSchema = z.object({
	id: z.string().optional(),
	runId: z.string().optional(),
	firstObservedAt: z.string().optional(),
	severityRationale: z.string().optional(),
	reproductionSteps: z.array(z.string()).optional(),
	verification: z
		.object({
			retested: z.boolean(),
			reproduced: z.boolean(),
			matchingAssertionIds: z.array(z.string()),
		})
		.optional(),
	scenarioId: z.string(),
	version: z.number(),
	title: z.string(),
	level: LevelSchema,
	category: z.string(),
	outcome: z.enum([
		"passed",
		"failed",
		"inconclusive",
		"skipped",
		"blocked",
		"infrastructure_error",
	]),
	classification: z.enum([
		"confirmed",
		"intermittent",
		"suspected",
		"inconclusive",
		"passed",
	]),
	origin: z.enum(["application", "infrastructure", "policy"]),
	severity: z.enum(["info", "low", "medium", "high", "critical", "unassigned"]),
	attempts: z.array(AttemptSchema),
	evidenceIds: z.array(z.string()),
	expectedBehavior: z.string(),
	observedBehavior: z.string(),
	limitations: z.array(z.string()),
	replayable: z.boolean(),
	remediation: z
		.object({
			hypothesis: z.string(),
			suggestion: z.string(),
			verification: z.string(),
			verified: z.literal(false),
		})
		.optional(),
});
export type ScenarioResult = z.infer<typeof ScenarioResultSchema>;
export const RunSchema = z.object({
	id: z.string(),
	state: RunStateSchema,
	createdAt: z.string(),
	updatedAt: z.string(),
	startedAt: z.string().nullable(),
	finishedAt: z.string().nullable(),
	request: CreateRunSchema,
	results: z.array(ScenarioResultSchema),
	evidence: z.array(EvidenceSchema),
	metrics: z.object({
		actualNetworkRequests: z.number(),
		simulatedEvents: z.number(),
		failedRequests: z.number(),
		serverErrors: z.number(),
		rejectedRequests: z.number(),
		blockedRequests: z.number(),
		latencyMs: z.array(z.number()),
	}),
	environment: z
		.object({
			engineVersion: z.string(),
			nodeVersion: z.string(),
			platform: z.string(),
			browserVersion: z.string().optional(),
			targetKind: z.string(),
			fixtureVariant: z.string().optional(),
			targetOrigin: z.string().optional(),
			isolated: z.boolean(),
		})
		.nullable(),
	error: z.string().nullable(),
	replayOf: z.string().nullable(),
	ai: z.object({
		status: z.enum(["disabled", "completed", "unavailable", "failed"]),
		explanation: z.string(),
		suggestions: z.array(z.string()),
		proposedScenarios: z.array(ScenarioSchema),
		requests: z.number(),
	}),
	revision: z.number(),
	progress: z
		.object({
			totalScenarios: z.number().int().nonnegative(),
			completedScenarios: z.number().int().nonnegative(),
			currentScenarioId: z.string().nullable(),
			percent: z.number().min(0).max(100),
		})
		.optional(),
});
export type Run = z.infer<typeof RunSchema>;
export const RecipeSchema = z.object({
	id: z.string(),
	version: z.number().int().positive(),
	title: z.string(),
	level: LevelSchema,
	category: z.string(),
	targetKinds: z.array(z.enum(["fixture", "loopback"])),
	prerequisites: z.array(z.string()),
	requiredFixtures: z.array(z.string()),
	steps: z.array(z.string()),
	expectedBehavior: z.string(),
	assertions: z.array(z.string()),
	safetyPermissions: z.array(z.string()),
	budget: z.record(z.string(), z.number()),
	cleanup: z.array(z.string()),
	evidenceRequirements: z.array(z.string()),
	replayable: z.boolean(),
	limitations: z.array(z.string()),
});
export type Recipe = z.infer<typeof RecipeSchema>;
export const CapabilitiesSchema = z.object({
	version: z.string(),
	apiVersion: z.literal("v1"),
	levels: z.array(
		z.object({
			level: z.number(),
			name: z.string(),
			targetKinds: z.array(z.string()),
		}),
	),
	targetKinds: z.array(z.string()),
	aiOptional: z.boolean(),
	aiConfigured: z.boolean(),
	limits: z.record(z.string(), z.number()),
	restrictions: z.array(z.string()),
});
export type Capabilities = z.infer<typeof CapabilitiesSchema>;
export const ComparisonSchema = z.object({
	before: z.string(),
	after: z.string(),
	changes: z.array(
		z.object({
			scenarioId: z.string(),
			before: z.string(),
			after: z.string(),
			change: z.enum([
				"not_comparable",
				"resolved_in_this_run",
				"regression",
				"unchanged",
				"changed",
			]),
		}),
	),
});
export type Comparison = z.infer<typeof ComparisonSchema>;
export const ReportSchema = z.object({
	schemaVersion: z.literal(1),
	generatedAt: z.string(),
	disclaimer: z.string(),
	run: RunSchema,
	summary: z.object({
		tested: z.number(),
		passed: z.number(),
		confirmed: z.number(),
		intermittent: z.number(),
		suspected: z.number(),
		inconclusive: z.number(),
		skipped: z.number(),
		blocked: z.number(),
		infrastructureErrors: z.number(),
		unexecuted: z.array(z.string()),
	}),
	coverage: z.array(
		z.object({
			level: z.number(),
			name: z.string(),
			scenarioIds: z.array(z.string()),
			mode: z.string(),
		}),
	),
	reproduction: z.array(
		z.object({
			scenarioId: z.string(),
			eligible: z.boolean(),
			instructions: z.string(),
		}),
	),
	artifactPrivacy: z.string(),
	regressionComparison: ComparisonSchema.nullable(),
});
export type Report = z.infer<typeof ReportSchema>;
export const RunEventSchema = z.object({
	id: z.number(),
	runId: z.string(),
	at: z.string(),
	type: z.enum(["state", "scenario", "progress", "evidence", "warning"]),
	data: z.record(z.string(), z.unknown()),
});
export type RunEvent = z.infer<typeof RunEventSchema>;
