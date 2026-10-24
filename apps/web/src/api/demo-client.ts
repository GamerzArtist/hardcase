import { z } from "zod";
import { type EngineClient, EngineError } from "./client";
import { CapabilitiesSchema, RecipeSchema, ReportSchema } from "./types";

const Manifest = z.object({
	mode: z.literal("recorded-demo"),
	capturedAt: z.string(),
	description: z.string(),
	runs: z.array(
		z.object({ id: z.string().uuid(), variant: z.enum(["clean", "faulty"]) }),
	),
	capabilities: CapabilitiesSchema,
	recipes: z.array(RecipeSchema),
});
/** Read-only transport for reviewed records from real fixture executions. Never simulates execution. */
export function createRecordedDemoClient(): EngineClient {
	async function read(path: string) {
		const response = await fetch(`/demo/${path}`, { redirect: "error" });
		if (
			!response.ok ||
			!response.headers.get("content-type")?.includes("application/json")
		)
			throw new EngineError(
				"offline",
				"Recorded evidence could not be loaded. Reconnect and retry.",
			);
		return response.json();
	}
	const manifest = () =>
		read("index.json").then((value) => Manifest.parse(value));
	async function report(id: string) {
		const index = await manifest();
		if (!index.runs.some((run) => run.id === id))
			throw new EngineError(
				"rejected",
				"This recorded run is not available.",
				404,
			);
		return ReportSchema.parse(await read(`runs/${id}.json`));
	}
	const unavailable = async (): Promise<never> => {
		throw new EngineError(
			"rejected",
			"This is a read-only demonstration of genuine recorded tests. Run the local application for live testing, cancellation and replay.",
		);
	};
	return {
		health: async () => ({ ok: true, version: "recorded-demo" }),
		ready: async () => {
			await manifest();
			return {
				ok: true,
				version: "recorded-demo",
				checks: { storage: true, worker: false, chromium: false },
				issues: [],
			};
		},
		capabilities: async () => (await manifest()).capabilities,
		recipes: async () => (await manifest()).recipes,
		listRuns: async (limit = 50, offset = 0) => {
			const index = await manifest();
			return Promise.all(
				index.runs
					.slice(offset, offset + limit)
					.map(async (item) => (await report(item.id)).run),
			);
		},
		getRun: async (id) => (await report(id)).run,
		findings: async (id) =>
			(await report(id)).run.results.filter(
				(result) => result.outcome !== "passed",
			),
		evidence: async (id) => (await report(id)).run.evidence,
		report,
		reportMarkdown: async (id) => {
			await report(id);
			const response = await fetch(`/demo/runs/${id}.md`, {
				redirect: "error",
			});
			if (!response.ok)
				throw new EngineError("offline", "Recorded export is unavailable.");
			return response.text();
		},
		downloadEvidence: async (runId, artifactId) => {
			const run = (await report(runId)).run;
			const artifact = run.evidence.find((item) => item.id === artifactId);
			if (!artifact)
				throw new EngineError(
					"rejected",
					"This artifact is not included in the public demonstration.",
					404,
				);
			const response = await fetch(`/demo/artifacts/${artifactId}`, {
				redirect: "error",
			});
			if (!response.ok)
				throw new EngineError("offline", "Recorded artifact is unavailable.");
			return new Blob([await response.arrayBuffer()], {
				type: artifact.mediaType,
			});
		},
		validateTarget: unavailable,
		validateScenario: unavailable,
		scenarioSchema: unavailable,
		createRun: unavailable,
		cancelRun: unavailable,
		replay: unavailable,
		compare: unavailable,
		events: async () => {},
	};
}
