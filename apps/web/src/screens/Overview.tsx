import {
	ArrowRight,
	ArrowUpRight,
	FolderOpen,
	Plus,
	RefreshCw,
	Search,
	ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { Run } from "../api/types";
import {
	Empty,
	Loading,
	Notice,
	PageHeader,
	Status,
} from "../components/Primitives";
import { dateLabel, targetLabel } from "../lib/model";
import { projectKey, summarizeHistory } from "../lib/overview";

export function Overview({
	history,
	loading,
	error,
	connected,
	hasMore,
	onRefresh,
	onMore,
	onOpen,
	onPrepare,
	onConnect,
}: {
	history: Run[];
	loading: boolean;
	error: string;
	connected: boolean;
	hasMore: boolean;
	onRefresh: () => void;
	onMore: () => void;
	onOpen: (id: string) => void;
	onPrepare: (run?: Run) => void;
	onConnect: () => void;
}) {
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState("all");
	const summary = useMemo(() => summarizeHistory(history), [history]);
	const filtered = history.filter(
		(run) =>
			(selected === "all" || projectKey(run) === selected) &&
			`${targetLabel(run)} ${run.id}`
				.toLowerCase()
				.includes(query.toLowerCase()),
	);
	const projects = summary.projects.filter((project) =>
		project.label.toLowerCase().includes(query.toLowerCase()),
	);
	return (
		<>
			<PageHeader
				title="All projects"
				description="Your applications, their test runs, and the evidence. One local workspace."
				action={
					<button
						type="button"
						className="button primary"
						onClick={() => onPrepare()}
					>
						<Plus size={16} /> New test
					</button>
				}
			/>
			<div className="overview-scope">
				<span>
					<ShieldCheck size={14} /> {history.length} loaded local runs · grouped
					by target
				</span>
				<button
					type="button"
					className="text-button"
					onClick={onRefresh}
					disabled={!connected || loading}
				>
					<RefreshCw size={13} /> Refresh
				</button>
			</div>
			{error && (
				<Notice
					tone="error"
					action={
						<button
							type="button"
							className="button small"
							onClick={onRefresh}
							disabled={!connected}
						>
							Retry
						</button>
					}
				>
					{error}
				</Notice>
			)}
			{!connected && (
				<Notice
					action={
						<button type="button" className="button small" onClick={onConnect}>
							Connect engine
						</button>
					}
				>
					Connect your local engine to load projects and run history.
				</Notice>
			)}
			{loading && !history.length ? (
				<Loading label="Loading your local workspace…" />
			) : !history.length ? (
				<Empty
					icon={<FolderOpen size={28} />}
					title="Your work starts here"
					action={
						<button
							type="button"
							className="button primary"
							onClick={() => onPrepare()}
						>
							Prepare your first test <ArrowRight size={16} />
						</button>
					}
				>
					Test the included disposable fixture or an application you own.
					Targets and genuine results appear here after a run.
				</Empty>
			) : (
				<>
					<dl className="overview-metrics">
						<div>
							<dt>Application targets</dt>
							<dd>{summary.projects.length}</dd>
							<small>Fixtures and local apps</small>
						</div>
						<div>
							<dt>Assertions passed</dt>
							<dd>
								{summary.passed}
								<span> / {summary.results.length}</span>
							</dd>
							<small>Recorded scenario outcomes</small>
						</div>
						<div>
							<dt>Application findings</dt>
							<dd>{summary.findings}</dd>
							<small>Includes suspected findings</small>
						</div>
						<div>
							<dt>Evidence artifacts</dt>
							<dd>{summary.evidence}</dd>
							<small>Stored with their runs</small>
						</div>
					</dl>
					<div className="overview-visuals">
						<section
							className="activity-chart"
							aria-labelledby="activity-heading"
						>
							<div className="overview-section-heading">
								<h2 id="activity-heading">Testing activity</h2>
								<span>Last 7 days · local time</span>
							</div>
							<div className="chart-container">
								<ResponsiveContainer width="100%" height="100%" minWidth={0}>
									<BarChart
										data={summary.days}
										margin={{ top: 14, right: 4, bottom: 0, left: -24 }}
										accessibilityLayer
									>
										<CartesianGrid
											vertical={false}
											stroke="var(--line)"
											strokeDasharray="3 5"
										/>
										<XAxis
											dataKey="day"
											axisLine={false}
											tickLine={false}
											tick={{ fill: "var(--muted)", fontSize: 11 }}
											dy={8}
										/>
										<YAxis
											allowDecimals={false}
											axisLine={false}
											tickLine={false}
											tick={{ fill: "var(--muted)", fontSize: 11 }}
										/>
										<Tooltip
											cursor={{ fill: "var(--surface-subtle)" }}
											contentStyle={{
												background: "var(--surface-raised)",
												color: "var(--text)",
												border: "1px solid var(--line)",
												borderRadius: 12,
												fontSize: 12,
											}}
										/>
										<Bar
											dataKey="completed"
											name="Completed runs"
											stackId="runs"
											fill="var(--chart-primary)"
											maxBarSize={32}
											isAnimationActive={false}
										/>
										<Bar
											dataKey="other"
											name="Other run states"
											stackId="runs"
											fill="var(--chart-secondary)"
											radius={[5, 5, 0, 0]}
											maxBarSize={32}
											isAnimationActive={false}
										/>
									</BarChart>
								</ResponsiveContainer>
							</div>
							<div className="chart-legend">
								<span>
									<i />
									Completed runs
								</span>
								<span>
									<i />
									Other states
								</span>
							</div>
							<details className="chart-data">
								<summary>View chart data</summary>
								<table>
									<thead>
										<tr>
											<th>Day</th>
											<th>Completed</th>
											<th>Other</th>
										</tr>
									</thead>
									<tbody>
										{summary.days.map((day) => (
											<tr key={day.day}>
												<th>{day.day}</th>
												<td>{day.completed}</td>
												<td>{day.other}</td>
											</tr>
										))}
									</tbody>
								</table>
							</details>
						</section>
						<section
							className="outcome-distribution"
							aria-labelledby="outcomes-heading"
						>
							<div className="overview-section-heading">
								<h2 id="outcomes-heading">Scenario outcomes</h2>
								<span>{summary.results.length} recorded</span>
							</div>
							{(
								[
									"passed",
									"failed",
									"inconclusive",
									"blocked",
									"infrastructure_error",
									"skipped",
								] as const
							).map((outcome) => {
								const count = summary.results.filter(
									(result) => result.outcome === outcome,
								).length;
								return (
									<div className={`outcome-bar ${outcome}`} key={outcome}>
										<div>
											<span>{outcome.replaceAll("_", " ")}</span>
											<strong>{count}</strong>
										</div>
										<div className="outcome-track">
											<span
												style={{
													width: `${summary.results.length ? (count / summary.results.length) * 100 : 0}%`,
												}}
											/>
										</div>
									</div>
								);
							})}
							<p>Run completion is separate from scenario success.</p>
						</section>
					</div>
					<div className="overview-projects">
						<div className="overview-section-heading">
							<h2>Applications</h2>
							<div className="input-with-icon">
								<Search size={15} />
								<input
									aria-label="Search projects and runs"
									placeholder="Find a target or run…"
									value={query}
									onChange={(event) => setQuery(event.target.value)}
								/>
							</div>
						</div>
						<div className="project-table">
							{projects.map((project) => {
								const latest = project.runs[0];
								const findings = project.runs
									.flatMap((run) => run.results)
									.filter(
										(result) =>
											result.outcome === "failed" &&
											result.origin === "application",
									).length;
								return (
									<div
										className={`project-row ${selected === project.key ? "selected" : ""}`}
										key={project.key}
									>
										<button
											type="button"
											className="project-name"
											onClick={() =>
												setSelected(
													selected === project.key ? "all" : project.key,
												)
											}
											aria-pressed={selected === project.key}
										>
											<span className="project-icon">
												<FolderOpen size={19} />
											</span>
											<span>
												<strong>{project.label}</strong>
												<small>
													{project.runs.length} runs · {findings} findings
												</small>
											</span>
										</button>
										<span className="project-latest">
											<Status value={latest.state} />
											<small>{dateLabel(latest.createdAt)}</small>
										</span>
										<button
											type="button"
											className="button small"
											onClick={() => onPrepare(latest)}
											aria-label={`Test again: ${project.label}`}
										>
											Test again <ArrowUpRight size={14} />
										</button>
									</div>
								);
							})}
							{!projects.length && (
								<p className="overview-no-match">
									No targets match this search.
								</p>
							)}
						</div>
					</div>
					<section className="overview-runs">
						<div className="overview-section-heading">
							<h2>
								{selected === "all"
									? "Recent runs"
									: "Runs for selected target"}
							</h2>
							{selected !== "all" && (
								<button
									type="button"
									className="text-button"
									onClick={() => setSelected("all")}
								>
									Show all targets
								</button>
							)}
						</div>
						{filtered.slice(0, 8).map((run) => (
							<button
								type="button"
								className="overview-run"
								key={run.id}
								onClick={() => onOpen(run.id)}
							>
								<Status value={run.state} />
								<span>
									<strong>{targetLabel(run)}</strong>
									<small>
										{run.id.slice(0, 8)} · {run.results.length} scenarios ·{" "}
										{dateLabel(run.createdAt)}
									</small>
								</span>
								<ArrowRight size={16} />
							</button>
						))}
						{!filtered.length && (
							<p className="overview-no-match">
								No matching runs. Try a different search.
							</p>
						)}
					</section>
					{hasMore && (
						<button
							type="button"
							className="button overview-load"
							onClick={onMore}
							disabled={loading}
						>
							{loading ? "Loading…" : "Load more history into overview"}
						</button>
					)}
				</>
			)}
		</>
	);
}
