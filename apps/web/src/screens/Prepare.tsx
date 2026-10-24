import {
	ArrowRight,
	Box,
	CheckCircle2,
	ChevronDown,
	Code2,
	FlaskConical,
	Link2,
	LockKeyhole,
	Play,
	ShieldCheck,
	SlidersHorizontal,
} from "lucide-react";
import type { FormEvent } from "react";
import type { EngineClient } from "../api/client";
import { parseScenarioInput } from "../api/scenario-input";
import type { Capabilities, Recipe } from "../api/types";
import { CheckControl, Notice, PageHeader } from "../components/Primitives";
import { ScenarioEditor } from "../components/ScenarioEditor";
import type { Draft } from "../lib/model";
import { LEVELS } from "../lib/model";
import type { Preferences } from "../state/preferences";
import type { Connection } from "../state/useEngine";
export function Prepare({
	draft,
	setDraft,
	recipes,
	capabilities,
	connection,
	busy,
	error,
	uncertain,
	onStart,
	onConnect,
	onReconcile,
	client,
}: {
	client: EngineClient | null;
	draft: Draft;
	setDraft: (draft: Draft) => void;
	recipes: Recipe[];
	capabilities: Capabilities | null;
	connection: Connection;
	busy: boolean;
	error: string;
	uncertain: boolean;
	onStart: () => void;
	onConnect: () => void;
	onReconcile: () => void;
	preferences: Preferences;
}) {
	const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
		setDraft({ ...draft, [key]: value });
	const count = recipes.filter(
		(recipe) =>
			recipe.level <= draft.tier &&
			recipe.targetKinds.includes(draft.targetKind),
	).length;
	let customScenarios: ReturnType<typeof parseScenarioInput> = [];
	try {
		if (draft.targetKind === "loopback" && draft.scenarioMode === "json")
			customScenarios = parseScenarioInput(draft.scenarioJson);
	} catch {
		/* Editor supplies validation feedback. */
	}
	const customCount =
		draft.scenarioMode === "json" ? customScenarios.length : 1;
	const selectedLevel =
		LEVELS.find((item) => item.level === draft.tier) || LEVELS[0];
	const submit = (event: FormEvent) => {
		event.preventDefault();
		if (!busy && !uncertain) {
			if (connection === "ready") onStart();
			else onConnect();
		}
	};
	return (
		<>
			<PageHeader
				title="Start a new test"
				description="A clear target. Deliberate pressure. Evidence you can act on."
				action={
					<span className="local-caption">
						<ShieldCheck size={15} />
						Local by design
					</span>
				}
			/>
			<form
				id="prepare-form"
				onSubmit={submit}
				className="prepare-grid"
				aria-label="Test configuration"
			>
				<div className="prepare-main">
					<section className="form-section">
						<div className="section-heading">
							<h2>
								<span className="form-step">01</span> What are we testing?
							</h2>
							<span className="subtle">Application target</span>
						</div>
						<fieldset className="target-options" aria-label="Target type">
							<button
								type="button"
								aria-pressed={draft.targetKind === "fixture"}
								className={`target-option ${draft.targetKind === "fixture" ? "selected" : ""}`}
								onClick={() => update("targetKind", "fixture")}
							>
								<FlaskConical size={21} />
								<span>
									<strong>Demo fixture</strong>
									<small>A disposable local app</small>
								</span>
								<span className="radio-dot" />
							</button>
							<button
								type="button"
								aria-pressed={draft.targetKind === "loopback"}
								className={`target-option ${draft.targetKind === "loopback" ? "selected" : ""}`}
								onClick={() =>
									setDraft({
										...draft,
										targetKind: "loopback",
										tier: Math.min(2, draft.tier) as 1 | 2,
										allowFixtureFaults: false,
									})
								}
							>
								<Code2 size={21} />
								<span>
									<strong>Your local app</strong>
									<small>An app you own on localhost</small>
								</span>
								<span className="radio-dot" />
							</button>
						</fieldset>
						{draft.targetKind === "fixture" ? (
							<div className="fixture-config">
								<div className="fixture-icon">
									<Box size={20} />
								</div>
								<div>
									<strong>Notes application</strong>
									<p>
										The engine creates a fresh, isolated fixture for each run.
									</p>
								</div>
								<label className="sr-only" htmlFor="fixture-variant">
									Fixture variant
								</label>
								<select
									id="fixture-variant"
									value={draft.variant}
									onChange={(event) =>
										update("variant", event.target.value as Draft["variant"])
									}
								>
									<option value="clean">Clean variant</option>
									<option value="faulty">Faulty variant</option>
								</select>
							</div>
						) : (
							<div className="local-target-fields">
								<label htmlFor="target-url">Application URL</label>
								<div className="input-with-icon">
									<Link2 size={17} />
									<input
										id="target-url"
										type="url"
										required
										maxLength={2048}
										value={draft.baseUrl}
										onChange={(event) => update("baseUrl", event.target.value)}
										placeholder="http://127.0.0.1:3000"
										spellCheck={false}
									/>
								</div>
								<p className="field-hint">
									HTTP loopback only, with an explicit port. Public and LAN
									targets are unsupported.
								</p>
								<CheckControl
									checked={draft.ownership}
									onChange={(value) => update("ownership", value)}
								>
									I own this local application and authorize this test scenario.
								</CheckControl>
								<fieldset
									className="scenario-mode"
									aria-label="Scenario authoring mode"
								>
									<button
										type="button"
										aria-pressed={draft.scenarioMode === "builder"}
										onClick={() => update("scenarioMode", "builder")}
									>
										Simple assertion
									</button>
									<button
										type="button"
										aria-pressed={draft.scenarioMode === "json"}
										onClick={() => update("scenarioMode", "json")}
									>
										Custom scenario JSON
									</button>
								</fieldset>
								{draft.scenarioMode === "json" ? (
									<ScenarioEditor
										draft={draft}
										onChange={setDraft}
										client={client}
										connected={connection === "ready"}
									/>
								) : (
									<details className="scenario-builder" open>
										<summary>
											<span>
												<Code2 size={16} />
												Browser scenario
											</span>
											<ChevronDown size={15} />
										</summary>
										<div className="details-content">
											<label htmlFor="scenario-title">Scenario title</label>
											<input
												id="scenario-title"
												required
												maxLength={160}
												value={draft.scenarioTitle}
												onChange={(event) =>
													update("scenarioTitle", event.target.value)
												}
											/>
											<div className="field-pair">
												<div>
													<label htmlFor="scenario-path">Page path</label>
													<input
														id="scenario-path"
														required
														maxLength={500}
														value={draft.path}
														onChange={(event) =>
															update("path", event.target.value)
														}
														spellCheck={false}
													/>
												</div>
												<div>
													<label htmlFor="assertion-kind">Assertion</label>
													<select
														id="assertion-kind"
														value={draft.assertion}
														onChange={(event) =>
															update(
																"assertion",
																event.target.value as Draft["assertion"],
															)
														}
													>
														<option value="visible">Element is visible</option>
														<option value="text">Element contains text</option>
														<option value="no_browser_errors">
															No browser errors
														</option>
													</select>
												</div>
											</div>
											{draft.assertion !== "no_browser_errors" && (
												<>
													<label htmlFor="scenario-selector">
														CSS selector
													</label>
													<input
														id="scenario-selector"
														required
														maxLength={300}
														value={draft.selector}
														onChange={(event) =>
															update("selector", event.target.value)
														}
														spellCheck={false}
													/>
												</>
											)}
											{draft.assertion === "text" && (
												<>
													<label htmlFor="expected-text">Expected text</label>
													<input
														id="expected-text"
														required
														maxLength={2000}
														value={draft.expected}
														onChange={(event) =>
															update("expected", event.target.value)
														}
													/>
												</>
											)}
											<p className="field-hint">
												Navigate to the selected path, then execute this
												explicit assertion. The engine validates the scenario
												before starting.
											</p>
										</div>
									</details>
								)}
							</div>
						)}
					</section>
					<section className="form-section depth-configuration">
						<div className="section-heading">
							<h2>
								<span className="form-step">02</span> How far should we go?
							</h2>
							<span className="subtle">Maximum testing depth</span>
						</div>
						<fieldset className="level-options">
							<legend className="sr-only">
								Maximum testing level (includes preceding levels)
							</legend>
							{LEVELS.map((item) => {
								const supported =
									!capabilities ||
									capabilities.levels.some(
										(level) =>
											level.level === item.level &&
											level.targetKinds.includes(draft.targetKind),
									);
								const disabled =
									(draft.targetKind === "loopback" && item.level > 2) ||
									!supported;
								return (
									<label
										key={item.level}
										className={`level-option ${draft.tier === item.level ? "selected" : ""} ${draft.tier > item.level ? "included" : ""} ${disabled ? "disabled" : ""}`}
									>
										<input
											type="radio"
											name="tier"
											value={item.level}
											checked={draft.tier === item.level}
											onChange={() => update("tier", item.level)}
											disabled={disabled}
										/>
										<span className="level-number">
											{draft.tier > item.level ? (
												<CheckCircle2 size={16} />
											) : (
												item.level
											)}
										</span>
										<span>
											<strong>{item.name}</strong>
											<small>
												{disabled
													? "Disposable fixtures only"
													: item.description}
											</small>
										</span>
										{draft.tier === item.level && <ArrowRight size={17} />}
										{disabled && <LockKeyhole size={14} />}
									</label>
								);
							})}
						</fieldset>
						<div className="depth-description">
							<strong>
								{selectedLevel.name} includes levels 1–{draft.tier}
							</strong>
							<p>{selectedLevel.detail}</p>
						</div>
						{draft.tier >= 3 && (
							<CheckControl
								checked={draft.allowFixtureFaults}
								onChange={(value) => update("allowFixtureFaults", value)}
							>
								Allow fault injection in this disposable fixture. No external
								services are tested.
							</CheckControl>
						)}
					</section>
					<details className="advanced-section">
						<summary>
							<span>
								<SlidersHorizontal size={16} />
								Execution limits & context
							</span>
							<ChevronDown size={15} />
						</summary>
						<div className="details-content">
							<div className="field-pair">
								<div>
									<label htmlFor="duration">Time limit (seconds)</label>
									<input
										id="duration"
										type="number"
										min={1}
										max={Math.min(
											180,
											(capabilities?.limits.maxDurationMs || 180000) / 1000,
										)}
										required
										value={draft.budget.maxDurationMs / 1000}
										onChange={(event) =>
											update("budget", {
												...draft.budget,
												maxDurationMs: Number(event.target.value) * 1000,
											})
										}
									/>
								</div>
								<div>
									<label htmlFor="requests">Request limit</label>
									<input
										id="requests"
										type="number"
										min={1}
										max={Math.min(400, capabilities?.limits.maxRequests || 400)}
										required
										value={draft.budget.maxRequests}
										onChange={(event) =>
											update("budget", {
												...draft.budget,
												maxRequests: Number(event.target.value),
											})
										}
									/>
								</div>
								<div>
									<label htmlFor="concurrency">Concurrent requests</label>
									<input
										id="concurrency"
										type="number"
										min={1}
										max={Math.min(4, capabilities?.limits.maxConcurrency || 4)}
										required
										value={draft.budget.maxConcurrency}
										onChange={(event) =>
											update("budget", {
												...draft.budget,
												maxConcurrency: Number(event.target.value),
											})
										}
									/>
								</div>
								<div>
									<label htmlFor="rate">Requests per second</label>
									<input
										id="rate"
										type="number"
										min={1}
										max={Math.min(
											20,
											capabilities?.limits.requestsPerSecond || 20,
										)}
										required
										value={draft.budget.requestsPerSecond}
										onChange={(event) =>
											update("budget", {
												...draft.budget,
												requestsPerSecond: Number(event.target.value),
											})
										}
									/>
								</div>
							</div>
							<label htmlFor="test-goals">
								Context for the run <span className="subtle">Optional</span>
							</label>
							<textarea
								id="test-goals"
								maxLength={4000}
								rows={3}
								placeholder="What should hold true for this application?"
								value={draft.goals}
								onChange={(event) => update("goals", event.target.value)}
							/>
							<p className="field-hint">
								Context is local metadata. It does not generate tests. AI is
								disabled. Artifact cap: 32 MB; response cap: 1 MB.
							</p>
						</div>
					</details>
				</div>
				<aside className="plan-panel" aria-label="Run plan">
					<div className="plan-header">
						<span className="plan-cross">+</span>
						<h2>Your test plan</h2>
						<span className="plan-connection">
							<i className={connection} />
							{connection === "ready"
								? "Engine ready"
								: connection === "connecting"
									? "Connecting"
									: "Offline"}
						</span>
					</div>
					<div className="plan-target">
						<Box size={19} />
						<div>
							<strong>
								{draft.targetKind === "fixture"
									? "Notes application"
									: "Owned local application"}
							</strong>
							<span>
								{draft.targetKind === "fixture"
									? draft.variant === "clean"
										? "Clean control fixture"
										: "Seeded fault fixture"
									: draft.baseUrl}
							</span>
						</div>
					</div>
					<div className="plan-scenarios">
						<div className="plan-section-label">
							<span>Included scenarios</span>
							<span>
								{draft.targetKind === "fixture" ? count : customCount}
							</span>
						</div>
						{connection === "ready" ? (
							draft.targetKind === "fixture" ? (
								recipes
									.filter(
										(recipe) =>
											recipe.level <= draft.tier &&
											recipe.targetKinds.includes("fixture"),
									)
									.map((recipe) => (
										<details key={recipe.id} className="plan-recipe">
											<summary>
												<span className="plan-level">L{recipe.level}</span>
												<span>{recipe.title}</span>
												<ChevronDown size={13} />
											</summary>
											<p>{recipe.expectedBehavior}</p>
										</details>
									))
							) : (
								<p className="field-hint">
									Your explicit browser scenario. Each action and assertion is
									validated before execution.
								</p>
							)
						) : (
							<p className="field-hint">
								Connect the local engine to load its supported scenarios.
							</p>
						)}
					</div>
					<dl className="plan-limits">
						<div>
							<dt>Time limit</dt>
							<dd>{draft.budget.maxDurationMs / 1000}s</dd>
						</div>
						<div>
							<dt>Requests</dt>
							<dd>{draft.budget.maxRequests} maximum</dd>
						</div>
						<div>
							<dt>Browser</dt>
							<dd>Chromium</dd>
						</div>
						<div>
							<dt>Storage</dt>
							<dd>This machine</dd>
						</div>
					</dl>
					<div className="run-action">
						<div className="run-estimate">
							<span>
								{connection === "ready"
									? `${draft.targetKind === "fixture" ? count : customCount} ${draft.targetKind === "fixture" ? "built-in scenarios" : `explicit scenario${customCount === 1 ? "" : "s"}`}`
									: "Recipes load on connection"}
							</span>
							<span>≤ {draft.budget.maxDurationMs / 1000}s</span>
						</div>
						<button
							type="submit"
							className="button primary start-button"
							disabled={busy || uncertain || connection === "connecting"}
						>
							{busy
								? "Validating & submitting…"
								: connection === "connecting"
									? "Checking local engine…"
									: connection === "ready"
										? "Run test"
										: "Connect local engine"}
							{connection === "ready" ? (
								<Play size={16} />
							) : (
								<ArrowRight size={17} />
							)}
						</button>
						<span className="shortcut-hint">
							{connection === "ready"
								? "Ctrl + Enter to run"
								: "No account. No cloud dependency."}
						</span>
					</div>
				</aside>
			</form>
			{error && (
				<Notice
					tone="error"
					action={
						uncertain ? (
							<button
								type="button"
								className="button small"
								onClick={onReconcile}
							>
								Recover submission
							</button>
						) : undefined
					}
				>
					{error}
				</Notice>
			)}
			<div className="workflow-guide">
				<div>
					<span className="guide-number active">1</span>
					<span>
						<strong>Prepare</strong>
						<small>Define the boundaries</small>
					</span>
				</div>
				<span className="guide-line" />
				<div>
					<span className="guide-number">2</span>
					<span>
						<strong>Observe</strong>
						<small>Watch real execution</small>
					</span>
				</div>
				<span className="guide-line" />
				<div>
					<span className="guide-number">3</span>
					<span>
						<strong>Investigate</strong>
						<small>Follow the evidence</small>
					</span>
				</div>
			</div>
		</>
	);
}
