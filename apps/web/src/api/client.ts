import { z } from "zod";
import type {
	Capabilities,
	Comparison,
	CreateRun,
	Evidence,
	Recipe,
	Report,
	Run,
	RunEvent,
	ScenarioDefinition,
	ScenarioResult,
	Target,
} from "./types";
import {
	BudgetSchema,
	CapabilitiesSchema,
	ComparisonSchema,
	CreateRunSchema,
	EvidenceSchema,
	RecipeSchema,
	ReportSchema,
	RunEventSchema,
	RunSchema,
	ScenarioResultSchema,
	ScenarioSchema,
	TargetSchema,
} from "./types";

export type ErrorKind =
	| "auth"
	| "offline"
	| "contract"
	| "rejected"
	| "aborted"
	| "timeout";
export class EngineError extends Error {
	constructor(
		public readonly kind: ErrorKind,
		message: string,
		public readonly status?: number,
	) {
		super(message);
		this.name = "EngineError";
	}
}
export interface EngineClient {
	health(): Promise<{ ok: boolean; version: string }>;
	ready(): Promise<{
		ok: boolean;
		version: string;
		checks: { storage: boolean; worker: boolean; chromium: boolean };
		issues: { code: string; message: string }[];
	}>;
	capabilities(): Promise<Capabilities>;
	recipes(): Promise<Recipe[]>;
	validateTarget(target: Target): Promise<Target>;
	validateScenario(scenario: ScenarioDefinition): Promise<ScenarioDefinition>;
	scenarioSchema(): Promise<Record<string, unknown>>;
	createRun(input: CreateRun, operationKey?: string): Promise<Run>;
	listRuns(limit?: number, offset?: number): Promise<Run[]>;
	getRun(id: string): Promise<Run>;
	cancelRun(id: string): Promise<Run>;
	findings(id: string): Promise<ScenarioResult[]>;
	evidence(id: string): Promise<Evidence[]>;
	report(id: string, compareTo?: string): Promise<Report>;
	reportMarkdown(id: string): Promise<string>;
	downloadEvidence(runId: string, artifactId: string): Promise<Blob>;
	replay(
		id: string,
		scenarioIds: string[],
		operationKey?: string,
	): Promise<Run>;
	compare(before: string, after: string): Promise<Comparison>;
	events(
		id: string,
		after: number,
		options: { signal: AbortSignal; onEvent: (event: RunEvent) => void },
	): Promise<void>;
}

/** A replaceable, local-only transport. The bearer token is held only in this closure. */
export function createEngineClient({
	baseUrl,
	token,
}: {
	baseUrl: string;
	token?: string;
}): EngineClient {
	let origin: string;
	try {
		const parsed = new URL(baseUrl);
		const sameOriginApi =
			typeof location !== "undefined" &&
			parsed.origin === location.origin &&
			parsed.pathname === "/api";
		if (
			(!sameOriginApi &&
				(parsed.protocol !== "http:" ||
					!["127.0.0.1", "localhost"].includes(parsed.hostname))) ||
			parsed.username ||
			parsed.password ||
			(!sameOriginApi && parsed.pathname !== "/") ||
			parsed.search ||
			parsed.hash
		)
			throw new Error();
		origin = parsed.origin + (sameOriginApi ? "/api" : "");
	} catch {
		throw new EngineError(
			"contract",
			"Engine address must be an HTTP localhost origin without a path.",
		);
	}
	const safeMessage = (value: string) =>
		token ? value.split(token).join("[redacted]") : value;
	const pathId = (value: string) => encodeURIComponent(value);
	async function consume<T>(
		path: string,
		read: (response: Response) => Promise<T>,
		init: RequestInit = {},
		stream = false,
	): Promise<T> {
		const controller = new AbortController();
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			controller.abort();
		}, 12000);
		const externalSignal = init.signal;
		const abort = () => controller.abort();
		if (externalSignal?.aborted) controller.abort();
		else externalSignal?.addEventListener("abort", abort, { once: true });
		try {
			const headers = new Headers(init.headers);
			if (token && path !== "/v1/health")
				headers.set("Authorization", `Bearer ${token}`);
			if (init.body) headers.set("Content-Type", "application/json");
			const response = await fetch(origin + path, {
				...init,
				headers,
				signal: controller.signal,
				cache: "no-store",
				redirect: "error",
			});
			if (!response.ok && !(path === "/v1/ready" && response.status === 503)) {
				let message = `Engine request failed (${response.status}).`;
				try {
					const data: unknown = await response.json();
					if (
						typeof data === "object" &&
						data !== null &&
						"message" in data &&
						typeof data.message === "string"
					)
						message = safeMessage(data.message);
				} catch {
					/* keep generic message */
				}
				throw new EngineError(
					response.status === 401 || response.status === 403
						? "auth"
						: "rejected",
					message,
					response.status,
				);
			}
			// The request timeout covers connection establishment, not the life of an SSE stream.
			if (stream) clearTimeout(timer);
			return await read(response);
		} catch (error) {
			if (error instanceof EngineError) throw error;
			if (timedOut)
				throw new EngineError("timeout", "Engine request timed out.");
			if (controller.signal.aborted)
				throw new EngineError("aborted", "Engine request was cancelled.");
			throw new EngineError(
				"offline",
				"Cannot reach the local engine. Check that it is running and allows this frontend origin.",
			);
		} finally {
			clearTimeout(timer);
			externalSignal?.removeEventListener("abort", abort);
		}
	}
	async function json<T>(
		path: string,
		schema: z.ZodType<T>,
		body?: unknown,
		operationKey?: string,
	): Promise<T> {
		return consume(
			path,
			async (response) => {
				let data: unknown;
				try {
					data = await response.json();
				} catch {
					throw new EngineError("contract", "Engine returned invalid JSON.");
				}
				const parsed = schema.safeParse(data);
				if (!parsed.success)
					throw new EngineError(
						"contract",
						"Engine response does not match the expected v1 contract.",
					);
				return parsed.data;
			},
			body === undefined
				? {}
				: {
						method: "POST",
						body: JSON.stringify(body),
						headers: operationKey
							? { "Idempotency-Key": operationKey }
							: undefined,
					},
		);
	}
	const runPath = (id: string) => `/v1/runs/${pathId(id)}`;
	return {
		health: () =>
			json("/v1/health", z.object({ ok: z.boolean(), version: z.string() })),
		ready: () =>
			json(
				"/v1/ready",
				z.object({
					ok: z.boolean(),
					version: z.string(),
					checks: z.object({
						storage: z.boolean(),
						worker: z.boolean(),
						chromium: z.boolean(),
					}),
					issues: z.array(z.object({ code: z.string(), message: z.string() })),
				}),
			),
		capabilities: () => json("/v1/capabilities", CapabilitiesSchema),
		recipes: () => json("/v1/recipes", z.array(RecipeSchema)),
		validateTarget: (target) =>
			json("/v1/targets/validate", TargetSchema, target),
		validateScenario: (scenario) =>
			json("/v1/scenarios/validate", ScenarioSchema, scenario),
		scenarioSchema: () =>
			json("/v1/scenarios/schema", z.record(z.string(), z.unknown())),
		createRun: (input, operationKey) =>
			json("/v1/runs", RunSchema, input, operationKey),
		listRuns: (limit = 50, offset = 0) =>
			json(`/v1/runs?limit=${limit}&offset=${offset}`, z.array(RunSchema)),
		getRun: (id) => json(runPath(id), RunSchema),
		cancelRun: (id) => json(`${runPath(id)}/cancel`, RunSchema, {}),
		findings: (id) =>
			json(`${runPath(id)}/findings`, z.array(ScenarioResultSchema)),
		evidence: (id) => json(`${runPath(id)}/evidence`, z.array(EvidenceSchema)),
		report: (id, compareTo) =>
			json(
				`${runPath(id)}/report${compareTo ? `?compareTo=${pathId(compareTo)}` : ""}`,
				ReportSchema,
			),
		reportMarkdown: (id) =>
			consume(`${runPath(id)}/report?format=markdown`, (response) =>
				response.text(),
			),
		downloadEvidence: (runId, artifactId) =>
			consume(`${runPath(runId)}/evidence/${pathId(artifactId)}`, (response) =>
				response.blob(),
			),
		replay: (id, scenarioIds, operationKey) =>
			json(`${runPath(id)}/replay`, RunSchema, { scenarioIds }, operationKey),
		compare: (before, after) =>
			json("/v1/compare", ComparisonSchema, { before, after }),
		events: async (id, after, { signal, onEvent }) => {
			return consume(
				`${runPath(id)}/events?after=${Math.max(0, Math.floor(after))}`,
				async (response) => {
					if (
						!response.body ||
						!response.headers.get("content-type")?.includes("text/event-stream")
					)
						throw new EngineError(
							"contract",
							"Engine did not return an event stream.",
						);
					const reader = response.body.getReader();
					const decoder = new TextDecoder();
					let buffer = "";
					let cursor = after;
					const stop = () => {
						void reader.cancel().catch(() => {});
					};
					signal.addEventListener("abort", stop, { once: true });
					try {
						while (!signal.aborted) {
							const { done, value } = await reader.read();
							if (done) break;
							buffer += decoder.decode(value, { stream: true });
							buffer = buffer.replace(/\r\n/g, "\n");
							while (buffer.includes("\n\n")) {
								const boundary = buffer.indexOf("\n\n");
								const chunk = buffer.slice(0, boundary);
								buffer = buffer.slice(boundary + 2);
								const lines = chunk
									.split("\n")
									.filter((line) => line.startsWith("data:"))
									.map((line) => line.slice(5).trimStart());
								if (!lines.length) continue;
								let raw: unknown;
								try {
									raw = JSON.parse(lines.join("\n"));
								} catch {
									throw new EngineError(
										"contract",
										"Engine returned an invalid event.",
									);
								}
								const event = RunEventSchema.safeParse(raw);
								if (!event.success || event.data.runId !== id)
									throw new EngineError(
										"contract",
										"Engine event does not match the expected v1 contract.",
									);
								if (event.data.id > cursor) {
									cursor = event.data.id;
									onEvent(event.data);
								}
							}
							if (buffer.length > 1024 * 1024)
								throw new EngineError(
									"contract",
									"Engine event exceeded the stream buffer limit.",
								);
						}
					} catch (error) {
						if (error instanceof EngineError) throw error;
						if (!signal.aborted)
							throw new EngineError(
								"offline",
								"Engine event stream disconnected.",
							);
					} finally {
						signal.removeEventListener("abort", stop);
						await reader.cancel().catch(() => {});
						reader.releaseLock();
					}
				},
				{ signal, headers: { Accept: "text/event-stream" } },
				true,
			);
		},
	};
}
// Keep these schemas available at the boundary for callers that construct custom scenarios.
export { BudgetSchema, CreateRunSchema };
