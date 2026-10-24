import { parseScenarioInput } from "../api/scenario-input";
import type {
	Budget,
	CreateRun,
	Level,
	Recipe,
	Run,
	ScenarioDefinition,
} from "../api/types";

export const LEVELS: {
	level: Level;
	name: string;
	description: string;
	detail: string;
}[] = [
	{
		level: 1,
		name: "Normal",
		description: "Everyday paths",
		detail: "Save, reload, navigate, and check persistence in a real browser.",
	},
	{
		level: 2,
		name: "Chaos",
		description: "Unexpected usage",
		detail: "Repeated submissions, boundary values, interruption, and retry.",
	},
	{
		level: 3,
		name: "Hostile",
		description: "Permission boundaries",
		detail:
			"Check explicit authorization and simulated cost policies in a disposable fixture.",
	},
	{
		level: 4,
		name: "Siege",
		description: "Bounded pressure",
		detail:
			"Check throttling, deduplication, a bounded queue, and recovery in the fixture.",
	},
	{
		level: 5,
		name: "Breakpoint",
		description: "Failure & recovery",
		detail:
			"Inject fixture-only dependency faults and verify rollback and integrity.",
	},
];

export const SAFE_BUDGET: Budget = {
	maxDurationMs: 120000,
	maxRequests: 200,
	maxConcurrency: 2,
	requestsPerSecond: 10,
	maxArtifactBytes: 33554432,
	maxResponseBytes: 1048576,
};
export type Draft = {
	scenarioMode: "builder" | "json";
	scenarioJson: string;
	targetKind: "fixture" | "loopback";
	variant: "clean" | "faulty";
	baseUrl: string;
	ownership: boolean;
	tier: Level;
	allowFixtureFaults: boolean;
	budget: Budget;
	goals: string;
	scenarioTitle: string;
	path: string;
	selector: string;
	assertion: "visible" | "text" | "no_browser_errors";
	expected: string;
};
export const DEFAULT_DRAFT: Draft = {
	scenarioMode: "builder",
	scenarioJson: "",
	targetKind: "fixture",
	variant: "clean",
	baseUrl: "http://127.0.0.1:3000",
	ownership: false,
	tier: 2,
	allowFixtureFaults: false,
	budget: SAFE_BUDGET,
	goals: "",
	scenarioTitle: "Local application smoke check",
	path: "/",
	selector: "main",
	assertion: "visible",
	expected: "",
};

export function requestFromDraft(
	draft: Draft,
	recipes: Recipe[],
	enginePort?: string,
): CreateRun {
	const levels = LEVELS.filter((item) => item.level <= draft.tier).map(
		(item) => item.level,
	);
	let target: CreateRun["target"] = { kind: "fixture", variant: draft.variant };
	const scenarios: ScenarioDefinition[] = [];
	if (draft.tier >= 3 && !draft.allowFixtureFaults)
		throw new Error(
			"Allow fault injection in the disposable fixture to use levels 3–5.",
		);
	if (draft.targetKind === "loopback") {
		if (!draft.ownership)
			throw new Error(
				"Confirm that you own this local application and authorize the selected scenario.",
			);
		if (draft.tier > 2)
			throw new Error(
				"Local application targets support levels 1–2. Levels 3–5 require a disposable fixture.",
			);
		let url: URL;
		try {
			url = new URL(draft.baseUrl);
		} catch {
			throw new Error(
				"Enter a local HTTP address with an explicit port, such as http://127.0.0.1:3000.",
			);
		}
		if (
			url.protocol !== "http:" ||
			!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
			Number(url.port) < 1024 ||
			!url.port ||
			url.port === enginePort ||
			url.port === window.location.port ||
			url.username ||
			url.password ||
			url.hash
		)
			throw new Error(
				"Use an owned HTTP loopback app on port 1024–65535, separate from hardcase and the engine.",
			);
		if (url.hostname === "localhost") url.hostname = "127.0.0.1";
		if (draft.scenarioMode !== "json") {
			if (
				!/^\/(?!\/)[^\\\s]*$/.test(draft.path) ||
				/%2f|%5c|%00/i.test(draft.path)
			)
				throw new Error(
					"Use an origin-relative scenario path such as / or /settings.",
				);
			if (!draft.scenarioTitle.trim())
				throw new Error("Give your scenario a title.");
			if (draft.assertion !== "no_browser_errors" && !draft.selector.trim())
				throw new Error("Enter the CSS selector to check.");
			if (draft.assertion === "text" && !draft.expected.trim())
				throw new Error("Enter the text you expect to find.");
		}
		target = {
			kind: "loopback",
			baseUrl: url.href,
			approvedOrigins: [url.origin],
			acknowledgeOwnership: true,
		};
		if (draft.scenarioMode === "json") {
			const imported = parseScenarioInput(draft.scenarioJson);
			if (imported.some((item) => item.level > draft.tier))
				throw new Error(
					"Choose a testing depth that includes every imported scenario level.",
				);
			scenarios.push(...imported);
		} else
			scenarios.push({
				id: "local.smoke",
				version: 1,
				title: draft.scenarioTitle.trim(),
				level: draft.tier as 1 | 2,
				category: "custom",
				prerequisites: [],
				requiredFixtures: [],
				steps: [
					{ action: "navigate", path: draft.path },
					{ action: "assert", assertionId: "local.assertion" },
				],
				expectedBehavior:
					draft.assertion === "no_browser_errors"
						? "The page loads without browser errors."
						: draft.assertion === "text"
							? `${draft.selector} contains ${draft.expected}.`
							: `${draft.selector} is visible.`,
				assertions: [
					{
						id: "local.assertion",
						kind: draft.assertion,
						description: "Explicitly configured local page assertion",
						...(draft.assertion !== "no_browser_errors"
							? { selector: draft.selector.trim() }
							: {}),
						...(draft.assertion === "text" ? { expected: draft.expected } : {}),
					},
				],
				safetyPermissions: ["navigation"],
				budget: draft.budget,
				cleanup: "close-context",
				evidenceRequirements: ["screenshot", "trace", "network", "console"],
				replayable: false,
			});
	}
	const recipeIds =
		target.kind === "fixture"
			? recipes
					.filter(
						(recipe) =>
							levels.includes(recipe.level) &&
							recipe.targetKinds.includes("fixture"),
					)
					.map((recipe) => recipe.id)
			: undefined;
	if (target.kind === "fixture" && !recipeIds?.length)
		throw new Error(
			"No matching recipes were supplied by the engine. Reconnect and check its capabilities.",
		);
	return {
		target,
		levels,
		allowFixtureFaults: draft.allowFixtureFaults,
		...(recipeIds ? { recipeIds } : {}),
		scenarios,
		budget: draft.budget,
		...(draft.goals.trim() ? { goals: draft.goals.trim() } : {}),
		useAi: false,
	};
}

export function targetLabel(run: Run): string {
	return run.request.target.kind === "fixture"
		? `${run.request.target.variant === "clean" ? "Clean" : "Faulty"} notes fixture`
		: run.request.target.baseUrl;
}
export function stateLabel(value: string): string {
	return value
		.replaceAll("_", " ")
		.replace(/^\w/, (char) => char.toUpperCase());
}
export function timeLabel(ms: number): string {
	const seconds = Math.max(0, Math.floor(ms / 1000));
	return `${Math.floor(seconds / 60)
		.toString()
		.padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
export function dateLabel(value: string): string {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));
}
export function formatBytes(value: number): string {
	return value < 1024
		? `${value} B`
		: value < 1048576
			? `${(value / 1024).toFixed(1)} KB`
			: `${(value / 1048576).toFixed(1)} MB`;
}
export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export const messageOf = (error: unknown): string =>
	error instanceof Error
		? error.message
		: "An unexpected error occurred. Try again.";
