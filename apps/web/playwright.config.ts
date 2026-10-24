import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";
export default defineConfig({
	testDir: "./tests",
	timeout: 180000,
	expect: { timeout: 15000 },
	fullyParallel: false,
	workers: 1,
	reporter: "list",
	outputDir:
		process.env.HARDCASE_QA_DIR || join(tmpdir(), "hardcase-browser-qa"),
	use: {
		baseURL: process.env.HARDCASE_FRONTEND_URL || "http://127.0.0.1:4327",
		viewport: { width: 1440, height: 1000 },
		trace: "off",
		screenshot: "off",
		video: "off",
	},
	webServer: process.env.HARDCASE_FRONTEND_URL
		? undefined
		: {
				command: "npm --prefix ../.. run dev",
				url: "http://127.0.0.1:4327",
				reuseExistingServer: true,
				timeout: 30000,
			},
});
