import {
	ArrowLeft,
	ArrowRight,
	Check,
	CheckCheck,
	ChevronRight,
	Copy,
	Download,
	FileSearch,
	Filter,
	RefreshCw,
	Search,
	ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { EngineClient } from "../api/client";
import type { Run, ScenarioResult } from "../api/types";
import { isTerminal } from "../api/types";
import { EvidenceViewer } from "../components/EvidenceViewer";
import {
	Empty,
	Loading,
	Notice,
	PageHeader,
	Status,
} from "../components/Primitives";
import {
	downloadBlob,
	messageOf,
	stateLabel,
	targetLabel,
	timeLabel,
} from "../lib/model";
export function Investigate({
	run,
	loading,
	error,
	connected,
	client,
	preferredScenario,
	replaying,
	onReplay,
	onObserve,
	onPrepare,
}: {
	run: Run | null;
	loading: boolean;
	error: string;
	connected: boolean;
	client: EngineClient | null;
	preferredScenario: string | null;
	replaying: boolean;
	onReplay: (ids: string[]) => void;
	onObserve: () => void;
	onPrepare: () => void;
}) {
	const [filter, setFilter] = useState("");
	const [scope, setScope] = useState<"review" | "all">("review");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [mobileDetail, setMobileDetail] = useState(false);
	const [tab, setTab] = useState<
		"overview" | "assertions" | "evidence" | "reproduce"
	>("overview");
	const [actionError, setActionError] = useState("");
	const [copied, setCopied] = useState(false);
	const [exporting, setExporting] = useState(false);
	const selectedRunId = run?.id;
	useEffect(() => {
		void selectedRunId;
		setSelectedId(preferredScenario);
		setScope(preferredScenario ? "all" : "review");
		setMobileDetail(!!preferredScenario);
		setTab("overview");
		setFilter("");
		setActionError("");
	}, [selectedRunId, preferredScenario]);
	if (loading && !run)
		return (
			<>
				<PageHeader title="Investigate" />
				<Loading label="Loading recorded findings…" />
			</>
		);
	if (!run)
		return (
			<>
				<PageHeader
					title="Investigate"
					description="Findings with a clear path back to the evidence."
				/>
				{error && <Notice tone="error">{error}</Notice>}
				<Empty
					icon={<FileSearch size={30} />}
					title="Evidence comes from execution"
					action={
						<button
							type="button"
							className="button primary"
							onClick={onPrepare}
						>
							Prepare a test
							<ArrowRight size={16} />
						</button>
					}
				>
					<p>
						Your real findings, recorded assertions, and artifacts will appear
						after a local run starts.
					</p>
				</Empty>
			</>
		);
	const currentRun = run;
	const terminal = isTerminal(run.state);
	const review = run.results.filter(
		(result) => result.classification !== "passed",
	);
	const filtered = (scope === "review" ? review : run.results).filter(
		(result) =>
			`${result.title} ${result.category} ${result.severity} ${result.observedBehavior}`
				.toLowerCase()
				.includes(filter.toLowerCase()),
	);
	const selected =
		filtered.find((result) => result.scenarioId === selectedId) || filtered[0];
	const stepsFor = (result: ScenarioResult): string[] =>
		result.reproductionSteps?.length
			? result.reproductionSteps
			: result.attempts[0]?.actions.map(
					(action) => `${action.action}: ${JSON.stringify(action.details)}`,
				) || [];
	const reproduction = selected
		? [
				`${selected.title}`,
				`Run: ${run.id}`,
				`Target: ${targetLabel(run)}`,
				"",
				...stepsFor(selected).map((step, index) => `${index + 1}. ${step}`),
				"",
				`Expected: ${selected.expectedBehavior}`,
				`Observed: ${selected.observedBehavior}`,
				`Classification: ${selected.classification}`,
				...(selected.limitations.length
					? ["", `Limitations: ${selected.limitations.join(" ")}`]
					: []),
			].join("\n")
		: "";
	async function copy() {
		try {
			await navigator.clipboard.writeText(reproduction);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			setActionError(
				"Clipboard access was denied. Select and copy the reproduction text below.",
			);
		}
	}
	async function exportReport(format: "json" | "markdown") {
		if (!client || !connected || exporting) return;
		setExporting(true);
		setActionError("");
		try {
			const data =
				format === "json"
					? JSON.stringify(await client.report(currentRun.id), null, 2)
					: await client.reportMarkdown(currentRun.id);
			downloadBlob(
				new Blob([data], {
					type: format === "json" ? "application/json" : "text/markdown",
				}),
				`hardcase-${currentRun.id.slice(0, 8)}.${format === "json" ? "json" : "md"}`,
			);
		} catch (cause) {
			setActionError(messageOf(cause));
		} finally {
			setExporting(false);
		}
	}
	return (
		<>
			<PageHeader
				title="Follow the evidence"
				description={`${targetLabel(run)} · Run ${run.id.slice(0, 8)}`}
				action={
					<>
						<button
							type="button"
							className="button"
							disabled={!connected || exporting}
							onClick={() => void exportReport("json")}
						>
							<Download size={15} />
							{exporting ? "Exporting…" : "JSON report"}
						</button>
						<button
							type="button"
							className="button"
							disabled={!connected || exporting}
							onClick={() => void exportReport("markdown")}
						>
							Markdown
							<Download size={15} />
						</button>
					</>
				}
			/>
			{!connected && (
				<Notice>
					Engine disconnected. Recorded results are visible; artifact access,
					replay, and export require a connection.
				</Notice>
			)}
			{actionError && <Notice tone="error">{actionError}</Notice>}
			{error && <Notice tone="error">{error}</Notice>}
			<div className="report-overview">
				<Status value={run.state} />
				<span>
					<strong>{run.results.length}</strong> scenarios processed
				</span>
				<span>
					<strong>
						{
							run.results.filter((result) => result.classification === "passed")
								.length
						}
					</strong>{" "}
					passed
				</span>
				<span>
					<strong>{review.length}</strong> need review
				</span>
				{run.progress && (
					<span>
						<strong>
							{Math.max(
								0,
								run.progress.totalScenarios - run.progress.completedScenarios,
							)}
						</strong>{" "}
						unexecuted
					</span>
				)}
				<button type="button" className="text-button" onClick={onObserve}>
					View execution
					<ArrowRight size={14} />
				</button>
			</div>
			{!terminal && (
				<Notice>
					Execution is still in progress. Results shown here are partial;
					unexecuted scenarios have no result yet.
				</Notice>
			)}
			{run.error && (
				<Notice tone="error">
					Run {stateLabel(run.state).toLowerCase()}: {run.error}
				</Notice>
			)}
			<div
				className={`investigation-layout ${mobileDetail && selected ? "show-detail" : ""}`}
			>
				<section className="finding-index" aria-label="Scenario results">
					<div className="finding-filters">
						<div className="input-with-icon">
							<Search size={16} />
							<label className="sr-only" htmlFor="finding-search">
								Search findings
							</label>
							<input
								id="finding-search"
								placeholder="Search results…"
								value={filter}
								onChange={(event) => setFilter(event.target.value)}
							/>
						</div>
						<fieldset className="scope-control" aria-label="Result scope">
							<button
								type="button"
								className={scope === "review" ? "active" : ""}
								onClick={() => setScope("review")}
							>
								Needs review <span>{review.length}</span>
							</button>
							<button
								type="button"
								className={scope === "all" ? "active" : ""}
								onClick={() => setScope("all")}
							>
								All <span>{run.results.length}</span>
							</button>
						</fieldset>
					</div>
					{filtered.length ? (
						<div className="finding-list">
							{filtered.map((result) => (
								<button
									type="button"
									key={result.scenarioId}
									className={`finding-item ${result.scenarioId === selected?.scenarioId ? "selected" : ""}`}
									aria-pressed={result.scenarioId === selected?.scenarioId}
									onClick={() => {
										setSelectedId(result.scenarioId);
										setMobileDetail(true);
										setTab("overview");
									}}
								>
									<span className={`severity-mark ${result.severity}`} />
									<span>
										<strong>{result.title}</strong>
										<small>
											{stateLabel(result.classification)} · {result.category}
										</small>
										<span className="finding-tags">
											<span>{stateLabel(result.severity)}</span>
											<span>Level {result.level}</span>
										</span>
									</span>
									<ChevronRight size={15} />
								</button>
							))}
						</div>
					) : (
						<div className="index-empty">
							<Filter size={23} />
							<h3>
								{filter
									? "No matching results"
									: run.results.length
										? "No results need review"
										: terminal
											? "No scenario results"
											: "Results are on their way"}
							</h3>
							<p>
								{filter
									? "Try another search."
									: run.results.length
										? "Review passing assertions under All. This covers executed scenarios only."
										: ["failed", "cancelled", "timed_out"].includes(run.state)
											? "The run ended without scenario results. This is not a passing test."
											: terminal
												? "The engine supplied no scenario results for this run."
												: "The engine has not reported a completed scenario yet."}
							</p>
							{!!run.results.length && scope === "review" && (
								<button
									type="button"
									className="text-button"
									onClick={() => setScope("all")}
								>
									View all results
									<ArrowRight size={14} />
								</button>
							)}
						</div>
					)}
				</section>
				<section className="finding-inspector" aria-label="Finding inspector">
					{selected ? (
						<>
							<button
								type="button"
								className="text-button mobile-back"
								onClick={() => setMobileDetail(false)}
							>
								<ArrowLeft size={16} />
								All results
							</button>
							<div className="inspector-heading">
								<div className="inspector-classification">
									<Status value={selected.classification} />
									<span className="subtle">
										{stateLabel(selected.origin)} · Level {selected.level}
									</span>
								</div>
								<h2>{selected.title}</h2>
								<p>{selected.observedBehavior}</p>
								<div className="finding-meta">
									<span>
										<ShieldCheck size={14} />
										{selected.verification
											? selected.verification.reproduced
												? "Reproduced on retest"
												: selected.verification.retested
													? "Retested; not reproduced"
													: "Not retested"
											: "Verification details not supplied"}
									</span>
									<span>{selected.attempts.length} attempts</span>
									<span>{selected.evidenceIds.length} artifacts</span>
								</div>
							</div>
							<fieldset
								className="tabs inspector-tabs"
								aria-label="Finding detail view"
							>
								{(
									["overview", "assertions", "evidence", "reproduce"] as const
								).map((value) => (
									<button
										type="button"
										key={value}
										className={tab === value ? "active" : ""}
										onClick={() => setTab(value)}
									>
										{stateLabel(value)}
									</button>
								))}
							</fieldset>
							<div className="inspector-content">
								{tab === "overview" && (
									<>
										<div className="expected-observed">
											<div>
												<span className="data-label">Expected behavior</span>
												<p>{selected.expectedBehavior}</p>
											</div>
											<div>
												<span className="data-label">Observed behavior</span>
												<p>{selected.observedBehavior}</p>
											</div>
										</div>
										<div className="severity-explanation">
											<h3>{stateLabel(selected.severity)} severity</h3>
											<p>
												{selected.severityRationale ||
													"The engine did not supply a severity rationale for this result."}
											</p>
										</div>
										{selected.remediation && (
											<div className="remediation">
												<h3>
													Suggested remediation{" "}
													<span className="label-neutral">Unverified</span>
												</h3>
												<p>{selected.remediation.hypothesis}</p>
												<p>{selected.remediation.suggestion}</p>
												<span className="data-label">
													Required verification
												</span>
												<p>{selected.remediation.verification}</p>
											</div>
										)}
										{!!selected.limitations.length && (
											<div className="limitations">
												<h3>Limits of this finding</h3>
												<ul>
													{selected.limitations.map((item) => (
														<li key={item}>{item}</li>
													))}
												</ul>
											</div>
										)}
									</>
								)}
								{tab === "assertions" && (
									<div className="attempts">
										{selected.attempts.map((attempt) => (
											<section key={attempt.index} className="attempt">
												<div className="section-heading">
													<h3>Attempt {attempt.index}</h3>
													<span className="subtle">
														{stateLabel(attempt.outcome)} ·{" "}
														{timeLabel(attempt.durationMs)}
													</span>
												</div>
												{attempt.error && (
													<Notice tone="error">{attempt.error}</Notice>
												)}
												{attempt.assertions.map((assertion) => (
													<div className="assertion" key={assertion.id}>
														<span
															className={`assertion-symbol ${assertion.passed ? "good" : "bad"}`}
														>
															{assertion.passed ? <Check size={15} /> : "×"}
														</span>
														<div>
															<strong>{assertion.description}</strong>
															<div className="assertion-values">
																<span>
																	Expected{" "}
																	<code>
																		{JSON.stringify(assertion.expected) ??
																			"Not supplied"}
																	</code>
																</span>
																<span>
																	Observed{" "}
																	<code>
																		{JSON.stringify(assertion.observed) ??
																			"Not supplied"}
																	</code>
																</span>
															</div>
														</div>
													</div>
												))}
											</section>
										))}
										{!selected.attempts.length && (
											<p className="subtle">
												No execution attempts were supplied for this result.
											</p>
										)}
									</div>
								)}
								{tab === "evidence" && (
									<EvidenceViewer
										evidence={run.evidence.filter((item) =>
											selected.evidenceIds.includes(item.id),
										)}
										client={client}
										connected={connected}
									/>
								)}
								{tab === "reproduce" && (
									<>
										<div className="section-heading">
											<h3>Reproduction record</h3>
											<button
												type="button"
												className="text-button"
												onClick={() => void copy()}
											>
												{copied ? <CheckCheck size={15} /> : <Copy size={15} />}
												{copied ? "Copied" : "Copy steps"}
											</button>
										</div>
										<textarea
											className="reproduction-text"
											aria-label="Reproduction record"
											readOnly
											rows={12}
											value={reproduction}
										/>
										<button
											type="button"
											className="button primary"
											disabled={
												!connected ||
												replaying ||
												!terminal ||
												!selected.replayable ||
												run.request.target.kind !== "fixture"
											}
											onClick={() => onReplay([selected.scenarioId])}
										>
											<RefreshCw size={15} />
											{replaying
												? "Creating replay…"
												: "Replay in a fresh fixture"}
										</button>
										{(!selected.replayable ||
											run.request.target.kind !== "fixture") && (
											<p className="field-hint">
												Automatic replay is unavailable for this scenario.
												Configure a new authorized run in Prepare.
											</p>
										)}
									</>
								)}
							</div>
						</>
					) : (
						<Empty
							icon={<FileSearch size={28} />}
							title={
								review.length
									? "Choose a result to inspect"
									: "Review what was actually tested"
							}
						>
							<p>
								{run.results.length
									? "Select All to inspect passing assertions and their evidence. Passing does not establish that an application is bug-free."
									: "Results, reproduction records, and evidence appear only when supplied by the engine."}
							</p>
						</Empty>
					)}
				</section>
			</div>
			<p className="report-disclaimer">
				This report covers executed scenarios and declared assertions only.
				Passing does not establish that the application is safe, secure, or
				bug-free.
			</p>
		</>
	);
}
