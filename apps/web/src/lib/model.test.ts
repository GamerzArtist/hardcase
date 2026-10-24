import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Recipe } from "../api/types";
import { DEFAULT_DRAFT, requestFromDraft, timeLabel } from "./model";

const recipes = [
	{ id: "normal.workflow", level: 1, targetKinds: ["fixture"] },
	{ id: "chaos.boundaries", level: 2, targetKinds: ["fixture"] },
] as Recipe[];
beforeEach(() => vi.stubGlobal("window", { location: { port: "4327" } }));
describe("observable preparation rules", () => {
	it("builds an explicit safe fixture plan with AI disabled", () => {
		const request = requestFromDraft(DEFAULT_DRAFT, recipes, "4318");
		expect(request.target).toEqual({ kind: "fixture", variant: "clean" });
		expect(request.levels).toEqual([1, 2]);
		expect(request.recipeIds).toEqual(["normal.workflow", "chaos.boundaries"]);
		expect(request.useAi).toBe(false);
		expect(request.allowFixtureFaults).toBe(false);
	});
	it("requires explicit fault consent for higher levels", () => {
		expect(() =>
			requestFromDraft({ ...DEFAULT_DRAFT, tier: 5 }, recipes),
		).toThrow("fault injection");
	});
	it("does not invent recipes when the engine catalog is unavailable", () => {
		expect(() => requestFromDraft(DEFAULT_DRAFT, [])).toThrow(
			"No matching recipes",
		);
	});
	it("requires ownership before creating a local scenario", () => {
		expect(() =>
			requestFromDraft({ ...DEFAULT_DRAFT, targetKind: "loopback" }, recipes),
		).toThrow("Confirm that you own");
	});
	it.each([
		"https://example.com",
		"http://192.168.1.5:3000",
		"http://localhost:4318",
		"http://localhost:4327",
		"http://localhost:80",
	])("rejects unauthorized target %s", (baseUrl) => {
		expect(() =>
			requestFromDraft(
				{ ...DEFAULT_DRAFT, targetKind: "loopback", ownership: true, baseUrl },
				recipes,
				"4318",
			),
		).toThrow("owned HTTP loopback");
	});
	it("creates an explicit, non-replayable assertion for an owned app", () => {
		const request = requestFromDraft(
			{
				...DEFAULT_DRAFT,
				targetKind: "loopback",
				ownership: true,
				baseUrl: "http://localhost:3000",
				assertion: "text",
				expected: "Welcome",
			},
			recipes,
		);
		expect(request.target).toMatchObject({
			baseUrl: "http://127.0.0.1:3000/",
			approvedOrigins: ["http://127.0.0.1:3000"],
		});
		expect(request.recipeIds).toBeUndefined();
		expect(request.scenarios[0].steps).toEqual([
			{ action: "navigate", path: "/" },
			{ action: "assert", assertionId: "local.assertion" },
		]);
		expect(request.scenarios[0].replayable).toBe(false);
	});
	it("rejects an encoded path escape before execution", () => {
		expect(() =>
			requestFromDraft(
				{
					...DEFAULT_DRAFT,
					targetKind: "loopback",
					ownership: true,
					path: "/%2fexternal",
				},
				recipes,
			),
		).toThrow("origin-relative");
	});
	it("formats elapsed time without negative or invented values", () => {
		expect(timeLabel(-1)).toBe("00:00");
		expect(timeLabel(61000)).toBe("01:01");
	});
});
