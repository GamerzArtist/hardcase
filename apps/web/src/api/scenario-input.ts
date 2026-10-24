import { type ScenarioDefinition, ScenarioSchema } from "./types";

/** Local shape validation only. The engine is the policy and authorization boundary. */
export function parseScenarioInput(text: string): ScenarioDefinition[] {
	if (text.length > 262144)
		throw new Error("Scenario JSON must be no larger than 256 KB.");
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		throw new Error(
			"Invalid JSON. Check brackets, commas and quoted property names.",
		);
	}
	const entries = Array.isArray(raw) ? raw : [raw];
	if (!entries.length || entries.length > 10)
		throw new Error("Import between 1 and 10 scenarios.");
	const scenarios = entries.map((entry, index) => {
		const parsed = ScenarioSchema.strict().safeParse(entry);
		if (!parsed.success) {
			const issue = parsed.error.issues[0];
			throw new Error(
				`Scenario ${index + 1} · ${issue.path.join(".") || "definition"}: ${issue.message}`,
			);
		}
		return parsed.data;
	});
	if (new Set(scenarios.map((item) => item.id)).size !== scenarios.length)
		throw new Error("Every imported scenario needs a unique id.");
	return scenarios;
}
