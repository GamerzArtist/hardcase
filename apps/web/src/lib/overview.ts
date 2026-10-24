import type { Run } from "../api/types";
import { targetLabel } from "./model";

export function projectKey(run: Run): string {
	const target = run.request.target;
	return target.kind === "fixture"
		? `fixture:${target.variant}`
		: new URL(target.baseUrl).origin;
}
export function summarizeHistory(runs: Run[], now = new Date()) {
	const projects = new Map<
		string,
		{ key: string; label: string; runs: Run[] }
	>();
	for (const run of runs) {
		const key = projectKey(run);
		const project = projects.get(key) || {
			key,
			label: targetLabel(run),
			runs: [],
		};
		project.runs.push(run);
		projects.set(key, project);
	}
	const days = Array.from({ length: 7 }, (_, index) => {
		const date = new Date(now);
		date.setHours(0, 0, 0, 0);
		date.setDate(date.getDate() - 6 + index);
		const next = new Date(date);
		next.setDate(next.getDate() + 1);
		const matches = runs.filter(
			(run) =>
				new Date(run.createdAt) >= date && new Date(run.createdAt) < next,
		);
		return {
			day: date.toLocaleDateString(undefined, { weekday: "short" }),
			total: matches.length,
			completed: matches.filter((run) => run.state === "completed").length,
			other: matches.filter((run) => run.state !== "completed").length,
		};
	});
	const results = runs.flatMap((run) => run.results);
	return {
		projects: [...projects.values()],
		days,
		results,
		passed: results.filter((result) => result.outcome === "passed").length,
		findings: results.filter(
			(result) =>
				result.outcome === "failed" && result.origin === "application",
		).length,
		evidence: runs.reduce((sum, run) => sum + run.evidence.length, 0),
	};
}
