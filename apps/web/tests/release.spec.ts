import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";

const captures = resolve(
	"C:/Users/GamerzArtist/.codex/visualizations/2026/10/22/01a162bd-a9f1-7422-afd6-166cb1d2bdab/final-sprint",
);
const proof = resolve("../../.engine/frontend-sprint-20261024/ui-proof.json");

test("custom JSON import executes the real controlled Reviewboard and retains truthful findings", async ({
	page,
}) => {
	test.setTimeout(120000);
	const moduleUrl = pathToFileURL(
		resolve("../../examples/reviewboard/server.mjs"),
	).href;
	const { startReviewboard } = await import(moduleUrl);
	const target = await startReviewboard({
		mode: "faulty",
		port: 0,
		dataDir: resolve(
			`../../.engine/frontend-sprint-20261024/reviewboard-${Date.now()}`,
		),
	});
	const apiPaths: string[] = [];
	page.on("request", (request) => {
		if (request.url().includes("/v1/")) apiPaths.push(request.url());
	});
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await mkdir(captures, { recursive: true });
	try {
		await page.goto("/app");
		await expect(
			page.getByText("Engine connected", { exact: true }),
		).toBeVisible();
		await page.screenshot({ path: resolve(captures, "prepare-desktop.png") });
		await page.screenshot({
			path: resolve("public/images/workspace-prepare.png"),
		});
		await page.getByRole("button", { name: /Your local app/ }).click();
		await page
			.getByLabel("Application URL", { exact: true })
			.fill(target.origin);
		await page.getByRole("checkbox", { name: /I own this local/ }).check();
		await page
			.getByRole("button", { name: "Custom scenario JSON", exact: true })
			.click();
		await page
			.getByLabel("Scenario definitions", { exact: true })
			.fill('{"invalid":true}');
		await page
			.getByRole("button", { name: "Validate with engine", exact: true })
			.click();
		await expect(page.getByRole("alert")).toContainText("Scenario 1");
		await page
			.getByLabel("Import scenario JSON", { exact: true })
			.setInputFiles([
				resolve("../../examples/reviewboard/scenarios/viewer-status.json"),
				resolve("../../examples/reviewboard/scenarios/editor-persistence.json"),
				resolve("../../examples/reviewboard/scenarios/login-recovery.json"),
			]);
		await page
			.getByRole("button", { name: "Validate with engine", exact: true })
			.click();
		await expect(page.getByText(/Definition accepted by engine/)).toBeVisible();
		await page.screenshot({
			path: resolve(captures, "custom-scenario-editor.png"),
		});
		await page.getByRole("button", { name: "Run test", exact: true }).click();
		await expect(page.locator(".run-summary .status")).toHaveText("Completed", {
			timeout: 100000,
		});
		await expect(page.locator(".scenario-row")).toHaveCount(3);
		const id = new URL(page.url()).searchParams.get("run");
		expect(id).toBeTruthy();
		await page.screenshot({ path: resolve(captures, "observe-desktop.png") });
		await page.screenshot({
			path: resolve("public/images/workspace-observe.png"),
		});
		await page
			.getByRole("button", { name: "Investigate", exact: true })
			.first()
			.click();
		await expect(page.locator(".finding-item")).toHaveCount(1);
		await expect(page.locator(".inspector-classification")).toContainText(
			"Suspected",
		);
		await page.getByRole("button", { name: "Evidence", exact: true }).click();
		await page
			.locator(".artifact-select")
			.filter({ hasText: "screenshot" })
			.first()
			.click();
		await expect(page.locator(".artifact-preview img")).toBeVisible();
		await page.locator(".artifact-preview").scrollIntoViewIfNeeded();
		await page.screenshot({
			path: resolve(captures, "investigate-desktop.png"),
		});
		await page.screenshot({
			path: resolve("public/images/workspace-investigate.png"),
		});
		await page.setViewportSize({ width: 390, height: 844 });
		await page.locator(".finding-item").first().click();
		await page.getByRole("button", { name: "Evidence", exact: true }).click();
		await page
			.locator(".artifact-select")
			.filter({ hasText: "screenshot" })
			.first()
			.click();
		await expect(page.locator(".artifact-preview img")).toBeVisible();
		await page.locator(".artifact-preview").scrollIntoViewIfNeeded();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
		).toBe(true);
		await page.screenshot({
			path: resolve(captures, "investigate-mobile.png"),
		});
		await page.getByRole("button", { name: "Reproduce", exact: true }).click();
		await expect(
			page.getByRole("button", {
				name: "Replay in a fresh fixture",
				exact: true,
			}),
		).toBeDisabled();
		await expect(page.getByLabel("Reproduction record")).toHaveValue(
			/Expected:/,
		);
		await page.reload();
		await expect(
			page.getByRole("heading", { name: "Follow the evidence", exact: true }),
		).toBeVisible();
		await page
			.getByRole("button", { name: "Prepare", exact: true })
			.last()
			.click();
		await page.screenshot({ path: resolve(captures, "prepare-mobile.png") });
		await page
			.getByRole("button", { name: "Open navigation", exact: true })
			.click();
		await page.keyboard.press("Escape");
		await expect(page.locator(".app-shell")).not.toHaveClass(/nav-open/);
		await page.setViewportSize({ width: 1440, height: 900 });
		await page
			.getByRole("button", { name: "Switch to dark theme", exact: true })
			.last()
			.click();
		await page.screenshot({ path: resolve(captures, "prepare-dark.png") });
		expect(errors).toEqual([]);
		await writeFile(
			proof,
			JSON.stringify(
				{
					runId: id,
					target: "controlled Reviewboard faulty variant",
					scenarioCount: 3,
					oneOriginVerified:
						apiPaths.length > 0 &&
						apiPaths.every(
							(url) =>
								new URL(url).origin === new URL(page.url()).origin &&
								new URL(url).pathname.startsWith("/api/v1/"),
						),
					apiRequestCount: apiPaths.length,
					expectedClassification: "suspected",
					browserErrors: errors,
					capturedAt: new Date().toISOString(),
				},
				null,
				2,
			),
		);
	} finally {
		await target.close();
	}
});

test("submission recovery reuses the operation key after a real response is lost", async ({
	page,
}) => {
	test.setTimeout(90000);
	await page.goto("/app");
	await expect(
		page.getByText("Engine connected", { exact: true }),
	).toBeVisible();
	const keys: string[] = [];
	let savedId = "";
	await page.route("**/v1/runs", async (route) => {
		if (route.request().method() !== "POST") return route.continue();
		keys.push(route.request().headers()["idempotency-key"]);
		if (keys.length === 1) {
			const response = await route.fetch();
			const body = await response.json();
			savedId = body.id ?? body.run?.id;
			await route.abort("failed");
		} else await route.continue();
	});
	await page.getByRole("button", { name: "Run test", exact: true }).click();
	await expect(page.getByRole("alert")).toContainText("response was lost");
	await page
		.getByRole("button", { name: "Recover submission", exact: true })
		.click();
	await expect(page.locator(".run-summary")).toBeVisible();
	expect(keys).toHaveLength(2);
	expect(keys[0]).toBe(keys[1]);
	expect(new URL(page.url()).searchParams.get("run")).toBe(savedId);
});

test("landing and menu renders at desktop, mobile and reduced motion without missing images", async ({
	page,
}) => {
	await mkdir(captures, { recursive: true });
	await page.goto("/");
	await expect(page.locator("#hero-heading")).toBeVisible();
	await expect(page.locator(".campus-model")).toBeVisible();
	await page.waitForFunction(() =>
		[...document.querySelectorAll<HTMLImageElement>(".cinema-hero img")].every(
			(img) => img.complete && img.naturalWidth > 0,
		),
	);
	await page.evaluate(() => document.fonts.ready);
	await page
		.getByRole("button", { name: "Reject optional", exact: true })
		.first()
		.click();
	await page.screenshot({ path: resolve(captures, "landing-desktop.png") });
	await page.getByRole("button", { name: /Application \+/ }).click();
	await expect(
		page.getByText("A real browser. Your actual interface.", { exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: /Application/ }).click();
	await page.setViewportSize({ width: 390, height: 844 });
	await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
	await page.screenshot({ path: resolve(captures, "landing-mobile.png") });
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBe(true);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await expect(page.locator(".campus-model")).toHaveCSS(
		"animation-name",
		"none",
	);
	await page.goto("/app");
	await expect(
		page.getByText("Connected to local engine", { exact: true }),
	).toBeVisible();
	await page.getByLabel("Fixture variant", { exact: true }).click();
	await page.screenshot({
		path: resolve(captures, "custom-dropdown-mobile.png"),
	});
	await page.keyboard.press("Escape");
	expect(
		await page.evaluate(() => CSS.supports("appearance", "base-select")),
	).toBe(true);
	await page.setViewportSize({ width: 720, height: 450 });
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBe(true);
	await page.screenshot({
		path: resolve(captures, "workspace-200-percent-equivalent.png"),
	});
	await page.goto("/");
	await expect(page.locator("#hero-heading")).toBeVisible();
	const sources = await page
		.locator("img")
		.evaluateAll((images) =>
			images.map((img) => (img as HTMLImageElement).src),
		);
	for (const source of sources) {
		const response = await page.request.get(source);
		expect(response.ok(), source).toBe(true);
		expect(response.headers()["content-type"]).toContain("image/");
	}
});

test("project overview connects real history, target preparation, dock and command navigation", async ({
	page,
}) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto("/app?view=overview");
	await expect(
		page.getByRole("heading", { name: "All projects", exact: true }),
	).toBeVisible();
	await expect(page.locator(".project-row").first()).toBeVisible();
	await expect(page.locator(".chart-container svg")).toBeVisible();
	await expect(
		page.getByRole("navigation", { name: "Workspace dock" }),
	).toBeHidden();
	await page.screenshot({ path: resolve(captures, "overview-desktop.png") });
	await page.setViewportSize({ width: 850, height: 900 });
	await expect(page.locator(".sidebar .brand > span")).toBeVisible();
	await page.screenshot({ path: resolve(captures, "workspace-medium.png") });
	await page
		.getByRole("button", { name: "Collapse sidebar", exact: true })
		.click();
	await expect(page.locator(".fluid-sidebar")).toBeHidden();
	await page.screenshot({ path: resolve(captures, "sidebar-collapsed.png") });
	await page
		.getByRole("button", { name: "Expand sidebar", exact: true })
		.click();
	await expect(page.locator(".fluid-sidebar")).toBeVisible();
	await page.setViewportSize({ width: 1440, height: 1000 });
	const first = page.locator(".project-row").first();
	const name = await first.locator(".project-name strong").textContent();
	await first.locator(".project-name").click();
	await expect(
		page.getByRole("heading", { name: "Runs for selected target" }),
	).toBeVisible();
	expect(await page.locator(".overview-run strong").allTextContents()).toEqual(
		expect.arrayContaining([name]),
	);
	await first.getByRole("button", { name: /Test again/ }).click();
	await expect(
		page.getByRole("heading", { name: "Start a new test" }),
	).toBeVisible();
	await page.screenshot({
		path: resolve(captures, "prepare-desktop-final.png"),
	});
	await page.keyboard.press("Control+k");
	await page.getByLabel("Find a command").fill("All projects");
	await page.keyboard.press("Enter");
	await expect(
		page.getByRole("heading", { name: "All projects", exact: true }),
	).toBeVisible();
	await page.keyboard.press("Control+k");
	await expect(page.locator(".command-dialog")).toHaveCSS("opacity", "1");
	await page.screenshot({
		path: resolve(captures, "command-palette-final.png"),
	});
	await page.keyboard.press("Escape");
	await expect(page.locator(".command-dialog")).toHaveCSS("display", "none");
	await page.setViewportSize({ width: 390, height: 844 });
	const dock = page.getByRole("navigation", { name: "Workspace dock" });
	await expect(dock).toBeVisible();
	await page.screenshot({ path: resolve(captures, "overview-mobile.png") });
	await dock.getByRole("button", { name: "Prepare", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "Start a new test" }),
	).toBeVisible();
	await expect(page.locator(".page-content")).toHaveCSS("opacity", "1");
	await page.screenshot({
		path: resolve(captures, "prepare-mobile-final.png"),
	});
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBe(true);
	expect(errors).toEqual([]);
});
