import {
	ArrowDown,
	ArrowRight,
	ArrowUpRight,
	BookOpen,
	Check,
	FileSearch,
	GitBranch,
	Monitor,
	Pause,
	Play,
	ShieldCheck,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import { lazy, Suspense, useState } from "react";
import { LEVELS } from "./lib/model";
import type { Preferences } from "./state/preferences";
import "./landing.css";

const AsciiVeil = lazy(() => import("./components/effects/AsciiVeil"));
const stations = [
	{
		name: "Application",
		icon: Monitor,
		title: "A real browser. Your actual interface.",
		body: "Navigate, type, submit and reload. Explicit scenarios exercise the application through Chromium.",
		position: "application",
	},
	{
		name: "Test engine",
		icon: GitBranch,
		title: "Deliberate pressure. Defined boundaries.",
		body: "Five progressive levels, explicit assertions and bounded execution. Every test stays inside its authorized target.",
		position: "engine",
	},
	{
		name: "Evidence",
		icon: FileSearch,
		title: "A finding you can follow all the way back.",
		body: "Recorded assertions, screenshots and reproduction steps connect a result to what actually happened.",
		position: "evidence",
	},
];
export default function Landing({ preferences }: { preferences: Preferences }) {
	const reduced = useReducedMotion();
	const [paused, setPaused] = useState(false);
	const [station, setStation] = useState<number | null>(null);
	const [level, setLevel] = useState(1);
	const [view, setView] = useState("prepare");
	const [faulty, setFaulty] = useState(false);
	const still = reduced || preferences.motion === "reduced" || paused;
	const image = `/images/meadow-${preferences.theme}.webp`;
	const chosen = LEVELS[level - 1];
	return (
		<div className="landing-v3">
			<section
				className={`cinema-hero ${still ? "is-still" : ""}`}
				aria-labelledby="hero-heading"
			>
				<div className="cinema-landscape">
					<img
						src={image}
						srcSet={`/images/meadow-${preferences.theme}-mobile.webp 768w, ${image} 1672w`}
						sizes="100vw"
						alt=""
						width="1672"
						height="940"
						fetchPriority="high"
					/>
				</div>
				{!still && preferences.graphics !== "standard" && (
					<Suspense fallback={null}>
						<AsciiVeil src={image} intensity={0.22} />
					</Suspense>
				)}
				<div className="cinema-copy">
					<h1 id="hero-heading">
						Test beyond
						<br />
						<em>the obvious.</em>
					</h1>
					<p>
						Your application, from every difficult angle. <br />
						Real browsers. Deliberate scenarios. Evidence you can use.
					</p>
					<div className="cinema-actions">
						<a href="/app" className="button primary">
							Open your workspace <ArrowUpRight size={17} />
						</a>
						<a href="#how" className="button cinema-secondary">
							<Play size={14} /> See the workflow
						</a>
					</div>
					<span className="cinema-assurance">
						<ShieldCheck size={13} /> Local-first. No account required.
					</span>
				</div>
				<fieldset
					className="testing-campus"
					aria-label="Interactive illustration of the testing workflow"
				>
					<img
						className="campus-model"
						src="/images/testing-campus.webp"
						alt="Architectural illustration of a browser, testing laboratory and evidence archive connected by glass channels"
						width="1536"
						height="1024"
					/>
					<svg
						className="campus-signals"
						viewBox="0 0 1000 550"
						aria-hidden="true"
					>
						<path d="M230 260L420 365L600 265L780 365" />
						<path d="M400 200L600 310L450 400" />
						<path className="signal" d="M230 260L420 365L600 265L780 365" />
						<path className="signal signal-two" d="M400 200L600 310L450 400" />
					</svg>
					{stations.map((item, index) => (
						<button
							type="button"
							key={item.name}
							className={`campus-pin ${item.position}`}
							aria-expanded={station === index}
							aria-controls="campus-description"
							onClick={() => setStation(station === index ? null : index)}
						>
							<item.icon size={16} />
							<span>{item.name}</span>
							<span className="pin-indicator">
								{station === index ? "−" : "+"}
							</span>
						</button>
					))}
					<div
						id="campus-description"
						className={`campus-description ${station !== null ? "visible" : ""}`}
						aria-live="polite"
					>
						{station !== null && (
							<>
								<strong>{stations[station].title}</strong>
								<p>{stations[station].body}</p>
							</>
						)}
					</div>
				</fieldset>
				<div className="cinema-baseline">
					<a href="#perspectives">
						<ArrowDown size={14} /> A closer look
					</a>
					<span>Workflow illustration · explore the three stations</span>
					<button
						type="button"
						onClick={() => setPaused(!paused)}
						aria-pressed={paused}
					>
						{still ? <Play size={13} /> : <Pause size={13} />}{" "}
						{paused ? "Resume scene" : "Pause scene"}
					</button>
				</div>
			</section>
			<section id="perspectives" className="landing-section blindspot-section">
				<div className="section-lead">
					<h2>
						Looks right.
						<br />
						<em>Until it doesn’t.</em>
					</h2>
					<p>
						A successful click is only the beginning. Does the change survive a
						reload? Does a viewer stay a viewer? What happens when the same
						request arrives twice?
					</p>
					<a className="editorial-link" href="/app">
						Test those assumptions <ArrowUpRight size={16} />
					</a>
				</div>
				<div className="comparison-document">
					<div className="document-bar">
						<span className="window-dots">
							<i />
							<i />
							<i />
						</span>
						<span>Persistence, examined</span>
						<span>Illustration</span>
					</div>
					<div className="comparison-content">
						<span className="document-caption">Expected invariant</span>
						<h3>Saved means saved.</h3>
						<p>
							The application acknowledges a change. After a reload, the same
							value should still exist.
						</p>
						<fieldset aria-label="Persistence illustration">
							<button
								type="button"
								aria-pressed={!faulty}
								onClick={() => setFaulty(false)}
							>
								What you expect
							</button>
							<button
								type="button"
								aria-pressed={faulty}
								onClick={() => setFaulty(true)}
							>
								What can break
							</button>
						</fieldset>
						<div className={`persistence-record ${faulty ? "lost" : ""}`}>
							<span>
								<Check size={16} /> Save acknowledged
							</span>
							<ArrowRight size={18} />
							<span>
								{faulty
									? "Value missing after reload"
									: "Value present after reload"}
							</span>
						</div>
						<p className="document-note">
							Illustrative comparison. Run the clean or faulty local fixture to
							collect real evidence.
						</p>
					</div>
				</div>
			</section>
			<section id="how" className="landing-section workflow-section">
				<div className="section-lead">
					<h2>
						From uncertainty
						<br />
						to something <em>concrete.</em>
					</h2>
					<p>
						One connected workspace. A short path from a testable question to a
						reproducible finding.
					</p>
				</div>
				<ol className="workflow-steps">
					{[
						{
							title: "Prepare",
							body: "Choose a local target, a testing level and the limits of execution.",
							icon: Monitor,
						},
						{
							title: "Observe",
							body: "Follow actual scenarios, recorded events and progress as the engine works.",
							icon: GitBranch,
						},
						{
							title: "Investigate",
							body: "Inspect assertions and artifacts. Reproduce the finding and export its record.",
							icon: FileSearch,
						},
					].map((item, i) => (
						<li key={item.title}>
							<span className="workflow-order">0{i + 1}</span>
							<item.icon size={24} />
							<h3>{item.title}</h3>
							<p>{item.body}</p>
						</li>
					))}
				</ol>
			</section>
			<section id="levels" className="level-section">
				<div className="landing-section">
					<div className="section-lead">
						<h2>
							Same application.
							<br />
							<em>Five different pressures.</em>
						</h2>
						<p>
							Choose your maximum depth. Each level includes the levels before
							it, with explicit limits and target restrictions.
						</p>
					</div>
					<div className="level-explorer">
						<fieldset aria-label="Explore testing levels">
							{LEVELS.map((item) => (
								<button
									type="button"
									key={item.level}
									aria-pressed={level === item.level}
									onClick={() => setLevel(item.level)}
								>
									<span>0{item.level}</span>
									{item.name}
									<ArrowRight size={16} />
								</button>
							))}
						</fieldset>
						<div className="level-explanation" key={level}>
							<span className="level-large" aria-hidden="true">
								0{level}
							</span>
							<h3>{chosen.name}</h3>
							<p>{chosen.detail}</p>
							<span className="level-boundary">
								<ShieldCheck size={15} />
								{level > 2
									? "Disposable fixtures only · explicit fault consent"
									: "Fixtures and owned local applications"}
							</span>
							<a href="/docs/testing-levels">
								Read the level boundaries <ArrowUpRight size={15} />
							</a>
						</div>
					</div>
				</div>
			</section>
			<section className="landing-section workflow-detail">
				<h2>
					Set the boundary.
					<br />
					<em>Keep the whole record.</em>
				</h2>
				<ol>
					{[
						"Choose an owned target",
						"Define scenarios and depth",
						"Set execution limits",
						"Observe the real run",
						"Inspect and reproduce",
						"Export the evidence",
					].map((text, i) => (
						<li key={text}>
							<span>{String(i + 1).padStart(2, "0")}</span>
							{text}
						</li>
					))}
				</ol>
			</section>
			<section className="workspace-showcase">
				<div className="showcase-heading">
					<h2>A place for the work.</h2>
					<fieldset aria-label="Workspace preview">
						{["prepare", "observe", "investigate"].map((item) => (
							<button
								type="button"
								key={item}
								aria-pressed={view === item}
								onClick={() => setView(item)}
							>
								{item}
							</button>
						))}
					</fieldset>
				</div>
				<div className="workspace-capture">
					<img
						src={`/images/workspace-${view}.png`}
						alt={`Hardcase ${view} workspace captured from the running application`}
						width="1440"
						height="900"
						loading="lazy"
					/>
				</div>
				<p>
					Actual local workspace capture. Controlled local test results
					illustrate the workflow; they are not results for your application.
				</p>
			</section>
			<section className="landing-section evidence-story">
				<div className="section-lead">
					<h2>
						A finding is only useful
						<br />
						if you can <em>follow it.</em>
					</h2>
					<p>
						Expected and observed behavior sit alongside the assertion, its
						attempts and the recorded artifact. The report preserves the chain.
					</p>
					<a href="/docs/evidence" className="editorial-link">
						How evidence works <ArrowUpRight size={16} />
					</a>
				</div>
				<dl className="evidence-chain">
					<div>
						<dt>Assertion</dt>
						<dd>The explicit condition being checked.</dd>
					</div>
					<div>
						<dt>Observation</dt>
						<dd>What the browser or request actually returned.</dd>
					</div>
					<div>
						<dt>Artifact</dt>
						<dd>Recorded screenshot, trace or structured evidence.</dd>
					</div>
					<div>
						<dt>Reproduction</dt>
						<dd>The actions and context needed to investigate again.</dd>
					</div>
				</dl>
			</section>
			<section className="landing-section local-story">
				<div
					className="local-diagram"
					role="img"
					aria-label="Application architecture"
				>
					<Monitor />
					<strong>Your application</strong>
					<span className="diagram-connector" />
					<GitBranch />
					<strong>Local test engine</strong>
					<span className="diagram-connector" />
					<FileSearch />
					<strong>Your evidence</strong>
				</div>
				<div className="section-lead">
					<h2>
						On your machine.
						<br />
						<em>Under your control.</em>
					</h2>
					<p>
						The interface and engine launch together. Your run history and
						artifacts stay in the engine’s local storage. No account or cloud
						service is needed for the supported test workflow.
					</p>
					<a href="/docs" className="editorial-link">
						Get started locally <ArrowUpRight size={16} />
					</a>
				</div>
			</section>
			<section className="landing-section scope-section">
				<h2>
					Power, with
					<br />
					<em>clear boundaries.</em>
				</h2>
				<div>
					<details>
						<summary>What can I test today?</summary>
						<p>
							Disposable Notes fixtures support all five levels. Applications
							you own on HTTP loopback support explicit custom browser scenarios
							at levels 1–2. Public and LAN targets are not supported.
						</p>
					</details>
					<details>
						<summary>Does it need an AI provider?</summary>
						<p>
							No. The supported deterministic workflow uses defined scenarios
							and real execution. The workspace submits runs with AI disabled.
						</p>
					</details>
					<details>
						<summary>Can I stop a test?</summary>
						<p>
							Yes. Stop requests cancellation from the engine. The interface
							waits for worker cleanup and shows the terminal state with any
							available evidence.
						</p>
					</details>
					<details>
						<summary>Can I replay or export?</summary>
						<p>
							Eligible fixture findings can be replayed in a fresh fixture.
							Reports export as JSON or Markdown; authenticated artifacts can be
							downloaded separately.
						</p>
					</details>
				</div>
			</section>
			<section
				className="landing-finale"
				style={{ backgroundImage: `url(${image})` }}
			>
				<div>
					<h2>
						Make the next thing
						<br />
						<em>harder to break.</em>
					</h2>
					<a href="/app" className="button primary">
						Start a local test <ArrowUpRight size={17} />
					</a>
					<a href="/docs" className="finale-docs">
						<BookOpen size={16} /> Read the documentation
					</a>
				</div>
			</section>
		</div>
	);
}
