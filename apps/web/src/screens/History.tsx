import { ArrowRight, Clock3, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import type { Run } from "../api/types";
import {
	Empty,
	Loading,
	Notice,
	PageHeader,
	Status,
} from "../components/Primitives";
import { dateLabel, targetLabel, timeLabel } from "../lib/model";
export function History({
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
	onPrepare: () => void;
	onConnect: () => void;
}) {
	const [search, setSearch] = useState("");
	const [state, setState] = useState("all");
	const filtered = history.filter(
		(run) =>
			(state === "all" || run.state === state) &&
			`${run.id} ${targetLabel(run)} ${run.state}`
				.toLowerCase()
				.includes(search.toLowerCase()),
	);
	return (
		<>
			<PageHeader
				title="Run history"
				description="Your local record. Every run, every outcome."
				action={
					<button
						type="button"
						className="button"
						onClick={onRefresh}
						disabled={!connected || loading}
					>
						<RefreshCw size={15} />
						{loading ? "Refreshing…" : "Refresh"}
					</button>
				}
			/>
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
					Connect the local engine to read its durable history.
				</Notice>
			)}
			<div className="history-filters">
				<div className="input-with-icon">
					<Search size={16} />
					<label className="sr-only" htmlFor="history-search">
						Search runs
					</label>
					<input
						id="history-search"
						placeholder="Search target or run ID…"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
				</div>
				<label className="sr-only" htmlFor="history-state">
					Filter by state
				</label>
				<select
					id="history-state"
					value={state}
					onChange={(event) => setState(event.target.value)}
				>
					<option value="all">All outcomes</option>
					{[
						"completed",
						"running",
						"queued",
						"failed",
						"cancelled",
						"timed_out",
						"partially_completed",
					].map((item) => (
						<option key={item} value={item}>
							{item.replaceAll("_", " ")}
						</option>
					))}
				</select>
				<span className="subtle">{history.length} loaded runs</span>
			</div>
			{loading && !history.length ? (
				<Loading label="Loading local run history…" />
			) : filtered.length ? (
				<div className="history-table">
					<div className="history-table-head">
						<span>Application / run</span>
						<span>Created</span>
						<span>Duration</span>
						<span>Outcome</span>
						<span />
					</div>
					{filtered.map((run) => (
						<button
							type="button"
							key={run.id}
							className="history-row"
							onClick={() => onOpen(run.id)}
						>
							<span className="history-target">
								<strong>{targetLabel(run)}</strong>
								<small>
									{run.id.slice(0, 8)} · Levels {run.request.levels.join(", ")}
									{run.replayOf ? " · Replay" : ""}
								</small>
							</span>
							<time>{dateLabel(run.createdAt)}</time>
							<span className="mono">
								{run.startedAt && run.finishedAt
									? timeLabel(
											new Date(run.finishedAt).getTime() -
												new Date(run.startedAt).getTime(),
										)
									: "—"}
							</span>
							<Status value={run.state} />
							<ArrowRight size={15} />
						</button>
					))}
				</div>
			) : (
				<Empty
					icon={<Clock3 size={30} />}
					title={
						search || state !== "all" ? "No matching runs" : "A clean slate"
					}
					action={
						<button
							type="button"
							className="button primary"
							onClick={
								search || state !== "all"
									? () => {
											setSearch("");
											setState("all");
										}
									: onPrepare
							}
						>
							{search || state !== "all"
								? "Clear filters"
								: "Prepare your first test"}
							<ArrowRight size={16} />
						</button>
					}
				>
					<p>
						{search || state !== "all"
							? "Try a different target, ID, or outcome."
							: "Completed, failed, and cancelled runs will appear here after the engine records them."}
					</p>
				</Empty>
			)}
			{hasMore && (
				<div className="load-more">
					<button
						type="button"
						className="button"
						disabled={loading || !connected}
						onClick={onMore}
					>
						{loading ? "Loading…" : "Load older runs"}
					</button>
				</div>
			)}
		</>
	);
}
