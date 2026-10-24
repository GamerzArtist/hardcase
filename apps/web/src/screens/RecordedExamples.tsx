import { ArrowRight, CheckCircle2, FileSearch, Monitor } from "lucide-react";
import type { Run } from "../api/types";
import { Loading, Notice, PageHeader } from "../components/Primitives";
import { LEVELS } from "../lib/model";
export function RecordedExamples({
	runs,
	loading,
	error,
	onOpen,
	onRetry,
}: {
	runs: Run[];
	loading: boolean;
	error: string;
	onOpen: (id: string) => void;
	onRetry: () => void;
}) {
	return (
		<>
			<PageHeader
				title="Explore real test evidence"
				description="Two controlled applications. The same eight scenarios. Inspect exactly what changed."
			/>
			<Notice>
				This public workspace contains genuine recorded fixture runs. It cannot
				start live tests, cancel a run or replay scenarios. The complete local
				application supports those workflows.
			</Notice>
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
			{loading && !runs.length ? (
				<Loading label="Loading recorded test evidence…" />
			) : (
				<div className="recorded-examples">
					{runs.map((run) => {
						const clean =
							run.request.target.kind === "fixture" &&
							run.request.target.variant === "clean";
						const failures = run.results.filter(
							(result) => result.classification === "confirmed",
						).length;
						return (
							<section className="recorded-example" key={run.id}>
								<div
									className={`recorded-example-icon ${clean ? "clean" : "faulty"}`}
								>
									{clean ? (
										<CheckCircle2 size={25} />
									) : (
										<FileSearch size={25} />
									)}
								</div>
								<span className="recorded-kicker">
									Actual Chromium execution · recorded
								</span>
								<h2>{clean ? "The clean fixture" : "The faulty fixture"}</h2>
								<p>
									{clean
										? "Eight passing scenarios check persistence, boundaries, permissions, pressure and recovery."
										: "Seven confirmed findings include acknowledged data loss and a permission boundary that fails on retest."}
								</p>
								<div className="recorded-counts">
									<strong>
										{run.results.length}
										<span>scenarios</span>
									</strong>
									<strong>
										{failures}
										<span>confirmed findings</span>
									</strong>
								</div>
								<button
									type="button"
									className={`button ${clean ? "" : "primary"}`}
									onClick={() => onOpen(run.id)}
								>
									Open recorded run <ArrowRight size={16} />
								</button>
							</section>
						);
					})}
				</div>
			)}
			<div className="recorded-levels">
				<h2>Five levels. Recorded outcomes.</h2>
				{LEVELS.map((level) => (
					<div key={level.level}>
						<span>0{level.level}</span>
						<strong>{level.name}</strong>
						<span>{level.description}</span>
					</div>
				))}
			</div>
			<div className="recorded-local">
				<Monitor size={22} />
				<div>
					<h2>Test your own application locally</h2>
					<p>
						The local application runs Chromium and stores its history on your
						machine. No cloud account is required. Owned local apps support
						levels 1–2; disposable fixtures support all five.
					</p>
					<a href="/docs" className="editorial-link">
						Set up the complete application <ArrowRight size={14} />
					</a>
				</div>
			</div>
		</>
	);
}
