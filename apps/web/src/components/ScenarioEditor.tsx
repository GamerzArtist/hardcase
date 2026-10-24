import { CheckCircle2, FileJson, Upload } from "lucide-react";
import { useRef, useState } from "react";
import type { EngineClient } from "../api/client";
import { parseScenarioInput } from "../api/scenario-input";
import type { Draft } from "../lib/model";
import { messageOf } from "../lib/model";
import { Notice } from "./Primitives";

export function ScenarioEditor({
	draft,
	onChange,
	client,
	connected,
}: {
	draft: Draft;
	onChange: (draft: Draft) => void;
	client: EngineClient | null;
	connected: boolean;
}) {
	const [error, setError] = useState("");
	const [validated, setValidated] = useState("");
	const [checking, setChecking] = useState(false);
	const current = useRef(draft.scenarioJson);
	current.current = draft.scenarioJson;
	let summary = "Paste one scenario object or an array of up to 10 scenarios.";
	try {
		const items = parseScenarioInput(draft.scenarioJson);
		summary = `${items.length} scenario${items.length === 1 ? "" : "s"} · ${items.reduce((sum, item) => sum + item.steps.length, 0)} actions · ${items.reduce((sum, item) => sum + item.assertions.length, 0)} assertions`;
	} catch {
		/* Explicit validation supplies actionable errors. */
	}
	function update(value: string) {
		setError("");
		setValidated("");
		onChange({ ...draft, scenarioJson: value });
	}
	async function validate() {
		setChecking(true);
		setError("");
		setValidated("");
		const text = draft.scenarioJson;
		try {
			const scenarios = parseScenarioInput(text);
			if (scenarios.some((item) => item.level > draft.tier))
				throw new Error(
					"Choose a testing depth that includes every imported scenario's level.",
				);
			if (!client || !connected)
				throw new Error(
					"Connect the local engine to validate its execution policy.",
				);
			for (const scenario of scenarios) await client.validateScenario(scenario);
			if (current.current === text) setValidated(text);
		} catch (cause) {
			if (current.current === text) setError(messageOf(cause));
		} finally {
			setChecking(false);
		}
	}
	return (
		<div className="scenario-json-editor">
			<div className="scenario-editor-toolbar">
				<label htmlFor="scenario-json">
					<FileJson size={16} /> Scenario definitions
				</label>
				<label className="button scenario-import">
					<Upload size={14} /> Import JSON
					<input
						type="file"
						accept=".json,application/json"
						multiple
						aria-label="Import scenario JSON"
						onChange={async (event) => {
							const files = Array.from(event.target.files || []);
							event.target.value = "";
							if (!files.length) return;
							if (files.reduce((sum, file) => sum + file.size, 0) > 262144) {
								setError("Import no more than 256 KB of JSON.");
								return;
							}
							try {
								const imported = (
									await Promise.all(
										files.map(async (file) =>
											parseScenarioInput(await file.text()),
										),
									)
								).flat();
								const text = JSON.stringify(
									imported.length === 1 ? imported[0] : imported,
									null,
									2,
								);
								parseScenarioInput(text);
								update(text);
							} catch (cause) {
								setError(messageOf(cause));
							}
						}}
					/>
				</label>
			</div>
			<textarea
				id="scenario-json"
				aria-describedby="scenario-json-hint"
				spellCheck={false}
				autoComplete="off"
				value={draft.scenarioJson}
				maxLength={262144}
				rows={13}
				onChange={(event) => update(event.target.value)}
				placeholder={
					'{\n  "id": "my-app.workflow",\n  "version": 1,\n  "level": 1,\n  …\n}'
				}
			/>
			<div className="scenario-validation">
				<span id="scenario-json-hint">{summary}</span>
				<button
					type="button"
					className="button"
					disabled={checking || !draft.scenarioJson.trim()}
					onClick={() => void validate()}
				>
					{checking ? "Validating…" : "Validate with engine"}
				</button>
			</div>
			{validated === draft.scenarioJson && validated && (
				<p className="scenario-valid" role="status">
					<CheckCircle2 size={16} /> Definition accepted by engine. Target
					authorization is checked when starting.
				</p>
			)}
			{error && <Notice tone="error">{error}</Notice>}
			<p className="field-hint">
				Definitions support allowlisted browser actions at levels 1–2. JSON
				stays in this tab's memory. Imported scenarios replace the simple
				builder; the engine validates every definition again before a run
				starts.
			</p>
		</div>
	);
}
