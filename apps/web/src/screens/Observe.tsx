import {
	Activity,
	ArrowRight,
	Box,
	CheckCircle2,
	Circle,
	Clock3,
	FileSearch,
	List,
	Pause,
	RefreshCw,
	ShieldCheck,
	Square,
	Terminal,
	XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Recipe, Run, RunEvent } from "../api/types";
import { isTerminal } from "../api/types";
import {
	Empty,
	Loading,
	Notice,
	PageHeader,
	Status,
} from "../components/Primitives";
import { planFor, ScenarioMap } from "../components/ScenarioMap";
import { dateLabel, stateLabel, targetLabel, timeLabel } from "../lib/model";
export function Observe({
	run,
	recipes,
	events,
	loading,
	error,
	connected,
	stream,
	cancelling,
	onCancel,
	onRetry,
	onPrepare,
	onInvestigate,
}: {
	run: Run | null;
	recipes: Recipe[];
	events: RunEvent[];
	loading: boolean;
	error: string;
	connected: boolean;
	stream: string;
	cancelling: boolean;
	onCancel: () => void;
	onRetry: () => void;
	onPrepare: () => void;
	onInvestigate: (scenario?: string) => void;
}) {
	const [tab, setTab] = useState<"timeline" | "spatial" | "activity">(
		"timeline",
	);
	const [selected, setSelected] = useState<string | null>(null);
	const [eventFilter, setEventFilter] = useState("");
	const [now, setNow] = useState(Date.now());
	const observedId = run?.id;
	const observedState = run?.state;
	const plan = useMemo(
		() => (run ? planFor(run, recipes) : []),
		[run, recipes],
	);
	useEffect(() => {
		if (!observedState || isTerminal(observedState)) return;
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, [observedState]);
	useEffect(() => {
		void observedId;
		setSelected(null);
	}, [observedId]);
	if (loading && !run)
		return (
			<>
				<PageHeader title="Opening your run" />
				<Loading label="Reading execution state from the engine…" />
			</>
		);
	if (!run)
		return (
			<>
				<PageHeader
					title="Observe"
					description="A clear view of what your application does under test."
				/>
				{error && (
					<Notice
						tone="error"
						action={
							<button type="button" className="button small" onClick={onRetry}>
								Retry
							</button>
						}
					>
						{error}
					</Notice>
				)}
				<Empty
					icon={<Activity size={30} />}
					title="Your next run starts here"
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
						Start a local test to follow its scenarios, execution events, and
						evidence as they arrive.
					</p>
				</Empty>
			</>
		);
	const terminal = isTerminal(run.state);
	const elapsed = run.startedAt
		? (run.finishedAt ? new Date(run.finishedAt).getTime() : now) -
			new Date(run.startedAt).getTime()
		: 0;
	const current = run.progress?.currentScenarioId;
	const focusedScenario = selected || current || plan[0]?.id;
	const selectedResult = run.results.find(
		(result) => result.scenarioId === focusedScenario,
	);
	const selectedPlan = plan.find((item) => item.id === focusedScenario);
	const filteredEvents = events.filter((item) =>
		`${item.type} ${JSON.stringify(item.data)}`
			.toLowerCase()
			.includes(eventFilter.toLowerCase()),
	);
	return (
		<>
			<PageHeader
				title={targetLabel(run)}
				description={`Run ${run.id.slice(0, 8)} · ${dateLabel(run.createdAt)}`}
				action={
					<>
						<button
							type="button"
							className="button"
							onClick={() => onInvestigate()}
						>
							Investigate
							<FileSearch size={16} />
						</button>
						{!terminal && (
							<button
								type="button"
								className="button danger"
								onClick={onCancel}
								disabled={!connected || cancelling}
							>
								<Square size={13} />
								{cancelling ? "Stopping…" : "Stop test"}
							</button>
						)}
					</>
				}
			/>
			{(!connected || error) && (
				<Notice
					tone="error"
					action={
						<button type="button" className="button small" onClick={onRetry}>
							Reconnect
						</button>
					}
				>
					{error || "Engine disconnected."} Showing the last known state. The
					test may still be running.
				</Notice>
			)}
			{cancelling && !terminal && (
				<Notice>
					Cancellation requested. Waiting for the engine to stop workers and
					finish cleanup.
				</Notice>
			)}
			{run.error && <Notice tone="error">{run.error}</Notice>}
			<section className="run-summary" aria-label="Run status">
				<div>
					<Status value={run.state} />
					<span className="run-summary-id">
						{run.request.levels.length} testing levels ·{" "}
						{run.request.target.kind === "fixture"
							? "Isolated fixture"
							: "Owned local app"}
					</span>
				</div>
				<div className="elapsed">
					<Clock3 size={16} />
					<span>{run.startedAt ? timeLabel(elapsed) : "Not started"}</span>
				</div>
				<div className="run-progress">
					<div>
						<span>
							{run.progress
								? `${run.progress.completedScenarios} / ${run.progress.totalScenarios} scenarios processed`
								: `${run.results.length} scenario results received`}
						</span>
						{run.progress && <strong>{run.progress.percent}%</strong>}
					</div>
					{run.progress ? (
						<progress
							aria-label="Scenarios processed"
							max={100}
							value={run.progress.percent}
						/>
					) : (
						<div className="progress-unknown" />
					)}
				</div>
			</section>
			<fieldset className="execution-counts" aria-label="Recorded run totals">
				<span>
					<strong>
						{
							run.results.filter((item) => item.classification === "passed")
								.length
						}
					</strong>{" "}
					passed
				</span>
				<span>
					<strong>
						{
							run.results.filter((item) => item.classification !== "passed")
								.length
						}
					</strong>{" "}
					need review
				</span>
				<span>
					<strong>{run.evidence.length}</strong> artifacts
				</span>
				<span className="execution-integrity">
					<ShieldCheck size={14} /> Recorded by the local engine
				</span>
			</fieldset>
			<div className="view-toolbar">
				<fieldset className="tabs" aria-label="Execution view">
					<button
						type="button"
						className={tab === "timeline" ? "active" : ""}
						onClick={() => setTab("timeline")}
					>
						<List size={15} />
						Timeline
					</button>
					<button
						type="button"
						className={tab === "spatial" ? "active" : ""}
						onClick={() => setTab("spatial")}
					>
						<Box size={15} />
						Scenario field
					</button>
					<button
						type="button"
						className={tab === "activity" ? "active" : ""}
						onClick={() => setTab("activity")}
					>
						<Terminal size={15} />
						Activity<span className="count">{events.length}</span>
					</button>
				</fieldset>
				<span className={`stream-indicator ${stream}`}>
					<span />
					{terminal
						? "Recorded execution"
						: stream === "live"
							? "Live event stream"
							: stream === "reconnecting"
								? "Reconnecting · state polling"
								: stream === "paused"
									? "Updates paused"
									: "Connecting events"}
				</span>
			</div>
			<div className="observation-grid">
				{tab === "spatial" && (
					<ScenarioMap
						run={run}
						plan={plan}
						selected={selected}
						onSelect={setSelected}
					/>
				)}
				{tab === "activity" ? (
					<div className="activity-panel">
						<label className="sr-only" htmlFor="activity-filter">
							Filter activity
						</label>
						<input
							id="activity-filter"
							placeholder="Filter recorded activity…"
							value={eventFilter}
							onChange={(event) => setEventFilter(event.target.value)}
						/>
						{filteredEvents.length ? (
							<div
								className="event-list"
								role="log"
								aria-live="off"
								aria-label="Recorded engine activity"
							>
								{filteredEvents.map((item) => (
									<div className={`event-row ${item.type}`} key={item.id}>
										<time>
											{new Date(item.at).toLocaleTimeString([], {
												hour12: false,
											})}
										</time>
										<span className="event-type">{item.type}</span>
										<code>
											{typeof item.data.message === "string"
												? item.data.message
												: JSON.stringify(item.data)}
										</code>
									</div>
								))}
							</div>
						) : (
							<Empty
								icon={<Terminal size={24} />}
								title={
									eventFilter ? "No matching events" : "Waiting for activity"
								}
							>
								<p>
									{eventFilter
										? "Try a different filter."
										: "Only records supplied by the engine appear here. Reloading resumes its durable event history."}
								</p>
							</Empty>
						)}
						<p className="field-hint">
							The latest 500 events are shown. Full artifacts remain available
							in Investigate.
						</p>
					</div>
				) : (
					<div className="timeline">
						<div className="table-heading">
							<span>Requested scenario</span>
							<span>Result</span>
						</div>
						{plan.length ? (
							plan.map((item, index) => {
								const result = run.results.find(
									(entry) => entry.scenarioId === item.id,
								);
								const active = current === item.id;
								const status =
									result?.classification ||
									(active ? "running" : terminal ? "unexecuted" : "pending");
								return (
									<button
										type="button"
										className={`scenario-row ${focusedScenario === item.id ? "selected" : ""}`}
										key={item.id}
										onClick={() => setSelected(item.id)}
										aria-pressed={focusedScenario === item.id}
									>
										<span className={`scenario-index ${status}`}>
											{result?.classification === "passed" ? (
												<CheckCircle2 size={18} />
											) : result?.outcome === "failed" ? (
												<XCircle size={18} />
											) : active ? (
												<Activity size={18} />
											) : terminal ? (
												<Pause size={16} />
											) : (
												<Circle size={16} />
											)}
										</span>
										<span className="scenario-info">
											<strong>{item.title}</strong>
											<small>
												Level {item.level} · {item.id}
											</small>
										</span>
										<span className="scenario-duration">
											{result
												? timeLabel(
														result.attempts.reduce(
															(sum, attempt) => sum + attempt.durationMs,
															0,
														),
													)
												: String(index + 1).padStart(2, "0")}
										</span>
										<Status value={status} />
										<ArrowRight size={14} />
									</button>
								);
							})
						) : (
							<Loading label="Waiting for the engine’s scenario plan…" />
						)}
					</div>
				)}
				{selectedPlan && (
					<section className="scenario-detail">
						<div className="section-heading">
							<h2>{selectedPlan.title}</h2>
							<button
								type="button"
								className="text-button"
								onClick={() => onInvestigate(focusedScenario)}
							>
								Open evidence
								<ArrowRight size={15} />
							</button>
						</div>
						{selectedResult ? (
							<>
								<div className="expected-observed">
									<div>
										<span className="data-label">Expected</span>
										<p>{selectedResult.expectedBehavior}</p>
									</div>
									<div>
										<span className="data-label">Observed</span>
										<p>{selectedResult.observedBehavior}</p>
									</div>
								</div>
								<span className="subtle">
									{selectedResult.attempts.length} attempts ·{" "}
									{selectedResult.evidenceIds.length} artifacts ·{" "}
									{stateLabel(selectedResult.classification)}
								</span>
							</>
						) : (
							<p className="subtle">
								{terminal
									? "This scenario was not executed. It is not a passing result."
									: "No result has been reported yet. The engine will supply assertions and evidence after execution."}
							</p>
						)}
					</section>
				)}
			</div>
			{terminal && (
				<div className="completion-strip">
					<CheckCircle2 size={20} />
					<div>
						<strong>
							{run.state === "completed"
								? "Execution complete. The evidence is ready."
								: `Execution ${stateLabel(run.state).toLowerCase()}. Review the available evidence.`}
						</strong>
						<p>
							{run.results.length} scenario results · {run.evidence.length}{" "}
							artifacts. Completion does not mean every assertion passed.
						</p>
					</div>
					<button
						type="button"
						className="button primary"
						onClick={() => onInvestigate()}
					>
						Investigate
						<ArrowRight size={16} />
					</button>
				</div>
			)}
			{!terminal && (
				<button
					type="button"
					className="text-button refresh-state"
					onClick={onRetry}
				>
					<RefreshCw size={14} />
					Refresh execution state
				</button>
			)}
		</>
	);
}
