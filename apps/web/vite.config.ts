import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	clearScreen: false,
	server: { host: "127.0.0.1", port: 4327, strictPort: true },
	build: { target: "es2022" },
	test: {
		include: ["src/**/*.test.ts"],
		environment: "node",
		restoreMocks: true,
	},
});
