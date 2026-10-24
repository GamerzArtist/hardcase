import { afterEach, describe, expect, it, vi } from "vitest";
import { createEngineClient } from "./client";

const client = () =>
	createEngineClient({
		baseUrl: "http://127.0.0.1:4318",
		token: "unit-only-session",
	});
afterEach(() => vi.unstubAllGlobals());
describe("local transport trust boundary", () => {
	it("routes an authenticated hosted session only through its own API origin", async () => {
		vi.stubGlobal("location", new URL("https://hardcase.example/app"));
		const request = vi.fn().mockResolvedValue(Response.json([]));
		vi.stubGlobal("fetch", request);
		await createEngineClient({
			baseUrl: "https://hardcase.example/api",
			token: "unit-session",
		}).listRuns();
		expect(request.mock.calls[0][0]).toBe(
			"https://hardcase.example/api/v1/runs?limit=50&offset=0",
		);
		expect(() =>
			createEngineClient({ baseUrl: "https://another.example/api" }),
		).toThrow();
	});
	it.each([
		"https://example.com",
		"http://10.0.0.1:4318",
		"http://127.0.0.1:4318/path",
		"http://user:pass@localhost:4318",
		"http://localhost:4318?token=secret",
	])("rejects unsafe origin %s", (baseUrl) => {
		expect(() => createEngineClient({ baseUrl })).toThrow(
			"HTTP localhost origin",
		);
	});
	it("sends no credential to health and sends a header to privileged routes", async () => {
		const mocked = vi
			.fn()
			.mockResolvedValueOnce(Response.json({ ok: true, version: "test" }))
			.mockResolvedValueOnce(Response.json([]));
		vi.stubGlobal("fetch", mocked);
		await client().health();
		await client().listRuns();
		expect(
			new Headers(mocked.mock.calls[0][1].headers).has("Authorization"),
		).toBe(false);
		expect(
			new Headers(mocked.mock.calls[1][1].headers).get("Authorization"),
		).toBe("Bearer unit-only-session");
		expect(mocked.mock.calls[1][0]).not.toContain("session");
		expect(mocked.mock.calls[1][1].redirect).toBe("error");
	});
	it("redacts an echoed credential from structured errors", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					Response.json(
						{ message: "Rejected unit-only-session" },
						{ status: 401 },
					),
				),
		);
		await expect(client().recipes()).rejects.toMatchObject({
			kind: "auth",
			message: "Rejected [redacted]",
		});
	});
	it("rejects invalid nested run responses instead of treating them as real results", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				Response.json([
					{
						id: "invented",
						state: "completed",
						results: [{ title: "Fake result" }],
					},
				]),
			),
		);
		await expect(client().listRuns()).rejects.toMatchObject({
			kind: "contract",
		});
	});
	it("does not retry a failed creation automatically", async () => {
		const fetchMock = vi
			.fn()
			.mockRejectedValue(new TypeError("Network unreachable"));
		vi.stubGlobal("fetch", fetchMock);
		await expect(
			client().createRun({
				target: { kind: "fixture", variant: "clean" },
				levels: [1],
				allowFixtureFaults: false,
				scenarios: [],
				budget: {
					maxDurationMs: 1000,
					maxRequests: 10,
					maxConcurrency: 1,
					requestsPerSecond: 5,
					maxArtifactBytes: 1024,
					maxResponseBytes: 1024,
				},
				useAi: false,
			}),
		).rejects.toMatchObject({ kind: "offline" });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
	it("handles split CRLF event boundaries, cursor replay and duplicate events", async () => {
		const encoder = new TextEncoder();
		const received: number[] = [];
		const event = (id: number) =>
			`id: ${id}\r\nevent: progress\r\ndata: ${JSON.stringify({ id, runId: "run-test", at: "2026-10-22T00:00:00Z", type: "progress", data: { message: "Recorded test event" } })}\r\n\r\n`;
		const full = `: heartbeat\r\n\r\n${event(1)}${event(2)}${event(2)}${event(3)}`;
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					new ReadableStream({
						start(controller) {
							for (const byte of encoder.encode(full))
								controller.enqueue(new Uint8Array([byte]));
							controller.close();
						},
					}),
					{ headers: { "Content-Type": "text/event-stream" } },
				),
			),
		);
		await client().events("run-test", 1, {
			signal: new AbortController().signal,
			onEvent: (entry) => received.push(entry.id),
		});
		expect(received).toEqual([2, 3]);
	});
	it("refuses events belonging to a different run", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					new Response(
						`data: ${JSON.stringify({ id: 1, runId: "wrong", at: "now", type: "state", data: { state: "running" } })}\n\n`,
						{ headers: { "Content-Type": "text/event-stream" } },
					),
				),
		);
		await expect(
			client().events("expected", 0, {
				signal: new AbortController().signal,
				onEvent: () => {},
			}),
		).rejects.toMatchObject({ kind: "contract" });
	});
});
