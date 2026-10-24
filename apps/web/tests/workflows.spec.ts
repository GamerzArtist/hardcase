import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

async function connect(page: Page) {
	await page.goto("/app");
	await expect(
		page.getByText("Engine connected", { exact: true }),
	).toBeVisible();
}
async function prepare(page: Page) {
	await page
		.getByRole("button", { name: "Prepare", exact: true })
		.first()
		.click();
}
async function complete(page: Page) {
	await expect(page.locator(".run-summary .status")).toHaveText("Completed", {
		timeout: 100000,
	});
}

test("real engine: all five levels, findings, artifacts, replay, exports and cancellation", async ({
	page,
}) => {
	test.setTimeout(240000);
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await connect(page);
	await prepare(page);
	await page.getByRole("radio").nth(4).check();
	await page.getByRole("checkbox", { name: /Allow fault injection/ }).check();
	await mkdir(resolve("public/images"), { recursive: true });
	await page.screenshot({
		path: resolve("public/images/workspace-prepare.png"),
	});
	await page.getByRole("button", { name: "Run test", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "Clean notes fixture", exact: true }),
	).toBeVisible();
	await complete(page);
	await expect(page.locator(".scenario-row")).toHaveCount(8);
	await expect(page.getByRole("progressbar")).toHaveAttribute("value", "100");
	await page.screenshot({
		path: resolve("public/images/workspace-observe.png"),
	});
	await page
		.getByRole("button", { name: "Scenario field", exact: true })
		.click();
	await expect(
		page.getByRole("group", { name: "Isometric view of actual run scenarios" }),
	).toBeVisible();
	await page.locator(".map-node").first().focus();
	await page.keyboard.press("Enter");
	await expect(page.locator(".scenario-detail")).toBeVisible();
	await page
		.getByRole("button", { name: "Investigate", exact: true })
		.first()
		.click();
	await expect(
		page.getByText("No results need review", { exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: /^All 8$/ }).click();
	await expect(page.locator(".finding-item")).toHaveCount(8);
	const jsonDownload = page.waitForEvent("download");
	await page.getByRole("button", { name: "JSON report", exact: true }).click();
	const jsonFile = await (await jsonDownload).path();
	if (!jsonFile) throw new Error("JSON download was not saved");
	const report = JSON.parse(await readFile(jsonFile, "utf8"));
	expect(report.summary.passed).toBe(8);
	expect(report.run.request.useAi).toBe(false);
	const mdDownload = page.waitForEvent("download");
	await page.getByRole("button", { name: /^Markdown/ }).click();
	const mdFile = await (await mdDownload).path();
	if (!mdFile) throw new Error("Markdown download was not saved");
	expect(await readFile(mdFile, "utf8")).toContain(
		"Application testing report",
	);
	await prepare(page);
	await page.getByLabel("Fixture variant").selectOption("faulty");
	await page.getByRole("button", { name: "Run test", exact: true }).click();
	await complete(page);
	await page
		.getByRole("button", { name: "Investigate", exact: true })
		.first()
		.click();
	await expect(page.locator(".finding-item")).toHaveCount(7);
	await page
		.getByRole("button", { name: /Acknowledged draft survives reload/ })
		.click();
	await expect(
		page.getByText("Reproduced on retest", { exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "Assertions", exact: true }).click();
	await expect(page.locator(".assertion")).not.toHaveCount(0);
	await page.getByRole("button", { name: "Evidence", exact: true }).click();
	await page
		.locator(".artifact-select")
		.filter({ hasText: "screenshot" })
		.first()
		.click();
	await expect(page.locator(".artifact-preview img")).toBeVisible();
	await page.screenshot({
		path: resolve("public/images/workspace-investigate.png"),
	});
	const artifactSources = await page
		.locator(".artifact-preview img")
		.getAttribute("src");
	expect(artifactSources).toMatch(/^blob:/);
	await page.getByRole("button", { name: "Reproduce", exact: true }).click();
	await expect(page.locator(".reproduction-text")).toHaveValue(/Expected:/);
	await page
		.getByRole("button", { name: "Replay in a fresh fixture", exact: true })
		.click();
	await complete(page);
	await expect(page.locator(".scenario-row")).toHaveCount(1);
	await prepare(page);
	await page.getByLabel("Fixture variant").selectOption("clean");
	await page.getByRole("button", { name: "Run test", exact: true }).click();
	await page.getByRole("button", { name: "Stop test", exact: true }).click();
	await expect(page.locator(".run-summary .status")).toHaveText("Cancelled", {
		timeout: 30000,
	});
	await page.getByRole("button", { name: /Run history/ }).click();
	await expect(page.locator(".history-row")).not.toHaveCount(0);
	await page.reload();
	await expect(page.locator(".history-row")).not.toHaveCount(0);
	expect(errors).toEqual([]);
});

test("real engine: explicit custom scenario against an owned loopback application", async ({
	page,
}) => {
	const server = createServer((_request, response) => {
		response.setHeader("Content-Type", "text/html");
		response.end(
			'<!doctype html><html lang="en"><title>Owned QA target</title><body><main>Hardcase local verification</main></body></html>',
		);
	});
	await new Promise<void>((resolveServer) =>
		server.listen(0, "127.0.0.1", resolveServer),
	);
	const address = server.address();
	try {
		await connect(page);
		await prepare(page);
		await page.getByRole("button", { name: /Your local app/ }).click();
		await page
			.getByLabel("Application URL", { exact: true })
			.fill(
				`http://127.0.0.1:${typeof address === "object" ? address?.port : 0}`,
			);
		await page.getByRole("checkbox", { name: /I own this local/ }).check();
		await page.getByLabel("Assertion", { exact: true }).selectOption("text");
		await page
			.getByLabel("Expected text", { exact: true })
			.fill("Hardcase local verification");
		await expect(page.getByRole("radio").nth(2)).toBeDisabled();
		await page.getByRole("button", { name: "Run test", exact: true }).click();
		await complete(page);
		await expect(page.locator(".scenario-row")).toHaveCount(1);
		await page
			.getByRole("button", { name: "Investigate", exact: true })
			.first()
			.click();
		await page.getByRole("button", { name: /^All 1$/ }).click();
		await page.getByRole("button", { name: "Reproduce", exact: true }).click();
		await expect(
			page.getByRole("button", {
				name: "Replay in a fresh fixture",
				exact: true,
			}),
		).toBeDisabled();
	} finally {
		await new Promise<void>((resolveServer) =>
			server.close(() => resolveServer()),
		);
	}
});

test("desktop and narrow navigation, keyboard, themes, empty and unavailable states", async ({
	page,
}) => {
	await page.goto("/app");
	await page
		.getByRole("button", { name: "Observe", exact: true })
		.first()
		.click();
	await expect(
		page.getByText("Your next run starts here", { exact: true }),
	).toBeVisible();
	await page.keyboard.press("Control+k");
	await expect(
		page.getByRole("dialog", { name: "Command menu" }),
	).toBeVisible();
	await page.getByLabel("Find a command", { exact: true }).fill("Prepare");
	await page.keyboard.press("Enter");
	await expect(
		page.getByRole("heading", { name: "Start a new test" }),
	).toBeVisible();
	await page
		.getByRole("button", { name: "Switch to dark theme", exact: true })
		.last()
		.click();
	await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
	await page
		.getByRole("button", { name: "Switch to light theme", exact: true })
		.last()
		.click();
	await page.setViewportSize({ width: 390, height: 844 });
	await page.waitForTimeout(250);
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth,
		),
	).toBe(true);
	await expect(
		page.getByRole("navigation", { name: "Workspace dock" }),
	).toBeVisible();
	await page
		.getByRole("button", { name: "Open navigation", exact: true })
		.click();
	await page.getByRole("button", { name: "Settings", exact: true }).click();
	await page
		.getByRole("checkbox", { name: "Enable GPU fallback", exact: true })
		.check();
	await page
		.getByRole("checkbox", { name: "Reduce motion", exact: true })
		.check();
	await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
	await page
		.getByLabel("Engine address", { exact: true })
		.fill("http://127.0.0.1:65534");
	await page.getByRole("button", { name: /^(Re)?connect engine$/i }).click();
	await expect(page.getByRole("alert")).toContainText(
		"Cannot reach the local engine",
	);
});

test("website, docs, legal routes and actual storage preferences", async ({
	page,
}) => {
	await page.goto("/");
	await expect(
		page.getByRole("heading", { name: /Test beyond/ }),
	).toBeVisible();
	expect(
		await page.evaluate(() => localStorage.getItem("hardcase.preferences.v1")),
	).toBeNull();
	await page
		.getByRole("button", { name: "Reject optional", exact: true })
		.first()
		.click();
	await page
		.getByRole("button", { name: "Switch to dark theme", exact: true })
		.last()
		.click();
	expect(
		await page.evaluate(() => localStorage.getItem("hardcase.preferences.v1")),
	).toBeNull();
	await page
		.getByRole("button", { name: "Storage preferences", exact: true })
		.click();
	await page
		.getByRole("checkbox", {
			name: "Remember display preferences",
			exact: true,
		})
		.check();
	await page
		.getByRole("button", { name: "Save my choice", exact: true })
		.click();
	expect(
		await page.evaluate(
			() =>
				JSON.parse(localStorage.getItem("hardcase.preferences.v1") || "{}")
					.theme,
		),
	).toBe("dark");
	for (const path of [
		"/docs",
		"/docs/testing-levels",
		"/docs/evidence",
		"/docs/api",
		"/docs/desktop",
		"/docs/troubleshooting",
		"/legal/privacy",
		"/legal/terms",
		"/legal/cookies",
		"/legal/contact",
		"/brand",
		"/missing-page",
	]) {
		await page.goto(path);
		await expect(page.locator("main h1")).toBeVisible();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
		).toBe(true);
	}
	await page.goto("/brand");
	await expect(
		page.getByRole("heading", { name: /A path less travelled/i }),
	).toBeVisible();
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/");
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBe(true);
});
