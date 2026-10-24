import {
	ArrowRight,
	ArrowUpRight,
	BookOpen,
	ChevronRight,
	Leaf,
	Menu,
	Moon,
	Search,
	Sun,
	X,
} from "lucide-react";
import { useState } from "react";
import { RECORDED_DEMO } from "./api/deployment";
import { Brand } from "./components/Primitives";
import Downloads from "./Downloads";
import Landing from "./Landing";
import { LEVELS } from "./lib/model";
import { usePreferences } from "./state/preferences";
import { openPrivacyControls } from "./state/privacy";
import "./site.css";

const docs = [
	{ path: "/docs", label: "Getting started", category: "Start here" },
	{
		path: "/docs/testing-levels",
		label: "The five testing levels",
		category: "The workflow",
	},
	{
		path: "/docs/evidence",
		label: "Findings & evidence",
		category: "The workflow",
	},
	{
		path: "/docs/api",
		label: "API & integration",
		category: "Build with hardcase",
	},
	{
		path: "/docs/desktop",
		label: "Desktop integration",
		category: "Build with hardcase",
	},
	{
		path: "/docs/troubleshooting",
		label: "Troubleshooting",
		category: "Reference",
	},
];
export default function Site({ path }: { path: string }) {
	const [preferences, setPreferences] = usePreferences();
	const [menu, setMenu] = useState(false);
	const landing = path === "/";
	const documentation = path.startsWith("/docs");
	const legal = path.startsWith("/legal/");
	const legalName = path.split("/").pop() || "";
	const validLegal = ["privacy", "terms", "cookies", "contact"].includes(
		legalName,
	);
	const known =
		landing ||
		(documentation && docs.some((doc) => doc.path === path)) ||
		(legal && validLegal);
	const theme = () =>
		setPreferences({
			...preferences,
			theme: preferences.theme === "light" ? "dark" : "light",
		});
	return (
		<div className={`site ${landing ? "site-landing" : ""}`}>
			<a className="skip-link" href="#site-main">
				Skip to content
			</a>
			<header className="site-header">
				<a className="site-logo" href="/" aria-label="hardcase home">
					<Brand />
				</a>
				<nav aria-label="Website navigation" className={menu ? "open" : ""}>
					<a href={landing ? "/app" : "/#how"}>
						{landing ? "Test" : "How it works"}
					</a>
					<a href="/docs" aria-current={documentation ? "page" : undefined}>
						{landing ? "Understand" : "Documentation"}
					</a>
					<a href="/downloads">Downloads</a>
				</nav>
				<div className="site-header-actions">
					<button
						type="button"
						className="icon-button"
						aria-label={`Switch to ${preferences.theme === "light" ? "dark" : "light"} theme`}
						onClick={theme}
					>
						{preferences.theme === "light" ? (
							<Moon size={17} />
						) : (
							<Sun size={17} />
						)}
					</button>
					<a href="/app" className="button primary">
						{RECORDED_DEMO ? "Recorded demo" : "Open workspace"}
						<ArrowUpRight size={15} />
					</a>
					<button
						type="button"
						className="icon-button site-menu"
						aria-label={menu ? "Close website menu" : "Open website menu"}
						onClick={() => setMenu((value) => !value)}
					>
						{menu ? <X size={20} /> : <Menu size={20} />}
					</button>
				</div>
			</header>
			<main id="site-main">
				{landing ? (
					<Landing preferences={preferences} />
				) : documentation && known ? (
					<Docs path={path} />
				) : path === "/downloads" ? (
					<Downloads />
				) : legal && validLegal ? (
					<Legal name={legalName} />
				) : (
					<ErrorPage code={path === "/error" ? "500" : "404"} />
				)}
			</main>
			<footer className="site-footer">
				<div>
					<a href="/" aria-label="hardcase home">
						<Brand />
					</a>
					<p>
						Different perspectives.
						<br />A more reliable product.
					</p>
				</div>
				<div className="footer-links">
					<div>
						<strong>Product</strong>
						<a href="/app">
							{RECORDED_DEMO ? "Recorded workspace" : "Local workspace"}
						</a>
						<a href="/docs">Documentation</a>
						<a href="/docs/testing-levels">Testing levels</a>
						<a href="/downloads">Download Hardcase</a>
					</div>
					<div>
						<strong>Good to know</strong>
						<a href="/legal/privacy">Privacy notice</a>
						<a href="/legal/terms">Terms of use</a>
						<a href="/legal/cookies">Cookies & storage</a>
						<button type="button" onClick={openPrivacyControls}>
							Storage preferences
						</button>
						<a href="/legal/contact">Contact</a>
					</div>
				</div>
				{path === "/" && (
					<div className="footer-signature" aria-hidden="true">
						<Brand />
					</div>
				)}
				<div className="footer-baseline">
					<span>hardcase · Local engineering software · 2026</span>
					<span>
						<Leaf size={13} />
						Local by design
					</span>
				</div>
			</footer>
		</div>
	);
}
function Docs({ path }: { path: string }) {
	const [search, setSearch] = useState("");
	const current = docs.find((doc) => doc.path === path) || docs[0];
	return (
		<div className="docs-layout">
			<aside className="docs-sidebar">
				<div className="docs-title">
					<BookOpen size={18} />
					<strong>Documentation</strong>
				</div>
				<div className="input-with-icon">
					<Search size={15} />
					<label className="sr-only" htmlFor="docs-search">
						Find a documentation page
					</label>
					<input
						id="docs-search"
						placeholder="Find a page…"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
				</div>
				<nav aria-label="Documentation pages">
					{docs
						.filter((doc) =>
							`${doc.label} ${doc.category}`
								.toLowerCase()
								.includes(search.toLowerCase()),
						)
						.map((doc, index, array) => (
							<div key={doc.path}>
								{(index === 0 ||
									array[index - 1].category !== doc.category) && (
									<span className="docs-category">{doc.category}</span>
								)}
								<a
									href={doc.path}
									className={path === doc.path ? "active" : ""}
									aria-current={path === doc.path ? "page" : undefined}
								>
									{doc.label}
									<ChevronRight size={13} />
								</a>
							</div>
						))}
				</nav>
				<a href="/app" className="docs-workspace-link">
					Back to the workspace
					<ArrowUpRight size={14} />
				</a>
			</aside>
			<article className="docs-article">
				<div className="docs-breadcrumb">
					<a href="/docs">Docs</a>
					<ChevronRight size={12} />
					<span>{current.label}</span>
				</div>
				<h1>{current.label}</h1>
				<p className="docs-lead">
					{path === "/docs"
						? "From a fresh workspace to a real, inspectable local test."
						: path === "/docs/testing-levels"
							? "Progressive testing, explicit scope, and a clear boundary around every run."
							: path === "/docs/evidence"
								? "A finding is a record you can inspect, not a score you have to trust."
								: path === "/docs/api"
									? "A versioned local API, isolated behind a typed and replaceable adapter."
									: path === "/docs/desktop"
										? "The React frontend is designed to run in a Tauri 2 webview."
										: "Recover a connection, reconcile a run, and keep the evidence intact."}
				</p>
				{path === "/docs" && (
					<>
						<h2>Open the local workspace</h2>
						<p>
							Go to <a href="/app">the workspace</a>. You can configure a test
							without an account. Execution needs a running local engine and its
							current bearer session.
						</p>
						<h2>Connect the engine</h2>
						<p>
							Start Hardcase from the repository root. One launcher starts the
							engine and frontend and connects the workspace automatically. The
							local session stays in memory; no sign-in is required.
						</p>
						<pre>{"npm ci\nnpx playwright install chromium\nnpm run dev"}</pre>
						<p>
							For a production web build, run <code>npm run build</code> then
							<code>npm start</code>. Settings provides manual connection
							recovery for a separately started engine. Keep its session file
							private.
						</p>
						<h2>Prepare a safe first run</h2>
						<ol>
							<li>
								Select <strong>Demo fixture</strong> and the{" "}
								<strong>Clean variant</strong>.
							</li>
							<li>
								Keep <strong>Chaos</strong> selected to run levels 1–2.
							</li>
							<li>
								Review Execution limits, then choose <strong>Run test</strong>.
							</li>
							<li>
								Observe actual scenario progress and open{" "}
								<strong>Investigate</strong> to inspect the results.
							</li>
						</ol>
						<h2>Test your own local app</h2>
						<p>
							Choose Your local app, provide an explicit HTTP loopback port,
							acknowledge ownership, and define a page path plus a
							visible-element, text, or browser-error assertion. Levels 1–2 are
							supported. Fixture recipes are not applied to arbitrary apps.
						</p>
					</>
				)}
				{path === "/docs/testing-levels" && (
					<>
						{LEVELS.map((item) => (
							<section key={item.level}>
								<h2>
									{item.level}. {item.name}
								</h2>
								<p>{item.detail}</p>
								<p className="docs-callout">
									{item.level <= 2
										? "Built-in fixtures use real Chromium. Owned loopback apps require an explicit custom browser scenario."
										: "Real bounded local HTTP requests exercise synthetic policies or injected faults in an engine-owned fixture. No production identity, provider billing, or external service is tested."}
								</p>
							</section>
						))}
						<h2>Progress is scenario completion</h2>
						<p>
							The engine supplies completed and total scenario counts. A percent
							is not a time estimate. Retests belong to their original scenario.
							A completed run may contain confirmed application defects.
						</p>
					</>
				)}
				{path === "/docs/evidence" && (
					<>
						<h2>Classification and origin</h2>
						<p>
							Results preserve the engine’s classification: confirmed,
							intermittent, suspected, inconclusive, or passed. Origin is
							separately recorded as application, infrastructure, or policy. An
							infrastructure failure is not automatically an application defect.
						</p>
						<h2>Inspect a finding</h2>
						<ol>
							<li>Select a result in Investigate.</li>
							<li>
								Read expected versus observed behavior, severity rationale, and
								verification status.
							</li>
							<li>
								Open Assertions to inspect each attempt and its expected and
								observed values.
							</li>
							<li>
								Open Evidence to view authenticated screenshots or JSON records.
							</li>
							<li>
								Use Reproduce to copy the recorded steps or replay an eligible
								fixture scenario.
							</li>
						</ol>
						<h2>Handle local artifacts carefully</h2>
						<p>
							Screenshots and traces can contain page data. They are fetched by
							stable artifact ID with the session header. PNGs and small JSON
							files can be previewed; trace ZIPs are downloaded for local
							inspection. The engine supplies SHA-256 metadata. This UI displays
							that hash and does not independently certify artifact integrity.
						</p>
						<h2>Export the actual report</h2>
						<p>
							JSON report and Markdown fetch the engine’s report endpoint and
							download its sanitized output. Suggested remediation is explicitly
							unverified. Passing does not establish that an application is
							safe, secure, or bug-free.
						</p>
						<h2>Retention</h2>
						<p>
							Engine history and artifacts stay in its configured local data
							directory until the owner removes them. There is currently no
							deletion, retention schedule, or total-history quota endpoint.
							Clearing browser preferences does not delete engine evidence.
						</p>
					</>
				)}
				{path === "/docs/api" && (
					<>
						<h2>Transport boundary</h2>
						<p>
							All backend calls live in <code>src/api/client.ts</code>. DTOs and
							runtime validation live in <code>src/api/types.ts</code>. React
							components use the EngineClient interface and never construct
							backend requests directly. The source of truth is the backend’s{" "}
							<code>docs/openapi.json</code> and{" "}
							<code>docs/FRONTEND_HANDOFF.md</code>.
						</p>
						<h2>Authentication</h2>
						<p>
							Every endpoint except health requires an Authorization Bearer
							header. Tokens never enter query strings or browser storage. Exact
							local CORS origins are required. Public and LAN engine origins are
							rejected by this adapter.
						</p>
						<div className="docs-table-wrap">
							<table>
								<thead>
									<tr>
										<th>Method</th>
										<th>Route</th>
										<th>Purpose</th>
									</tr>
								</thead>
								<tbody>
									{[
										["GET", "/v1/health", "Liveness; no authentication"],
										[
											"GET",
											"/v1/capabilities",
											"Supported targets, levels, and limits",
										],
										[
											"POST",
											"/v1/targets/validate",
											"Canonicalize an authorized target",
										],
										["GET", "/v1/recipes", "Executable built-in recipes"],
										[
											"POST",
											"/v1/scenarios/validate",
											"Validate a custom scenario",
										],
										["POST", "/v1/runs", "Queue a run; HTTP 202"],
										["GET", "/v1/runs", "Paginated run history"],
										["GET", "/v1/runs/{id}", "Durable execution snapshot"],
										[
											"GET",
											"/v1/runs/{id}/events",
											"Authenticated, resumable SSE",
										],
										[
											"POST",
											"/v1/runs/{id}/cancel",
											"Request cancellation and cleanup",
										],
										[
											"GET",
											"/v1/runs/{id}/evidence/{artifactId}",
											"Authenticated artifact bytes",
										],
										[
											"GET",
											"/v1/runs/{id}/report",
											"Structured or Markdown report",
										],
										[
											"POST",
											"/v1/runs/{id}/replay",
											"Replay eligible fixture scenarios",
										],
										["POST", "/v1/compare", "Compare compatible terminal runs"],
									].map(([method, route, purpose]) => (
										<tr key={route}>
											<td>{method}</td>
											<td>
												<code>{route}</code>
											</td>
											<td>{purpose}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<h2>Event recovery</h2>
						<p>
							Authenticated fetch streaming supplies headers that native
							EventSource cannot. Resume using the last event ID in the after
							cursor. The UI deduplicates records and polls durable run state. A
							lost mutation response must be reconciled against history before a
							manual retry.
						</p>
					</>
				)}
				{path === "/docs/desktop" && (
					<>
						<h2>Tauri shell</h2>
						<p>
							The frontend includes a Tauri 2 shell with native window
							decorations, a constrained CSP, and no general-purpose filesystem
							or shell access exposed to the webview. Use{" "}
							<code>npm run desktop:dev</code> from the repository root after
							installing the platform’s build prerequisites.
						</p>
						<h2>Local session handoff</h2>
						<p>
							The desktop launcher owns the engine lifecycle and supplies a
							validated local session through its narrow Tauri bridge. Browser
							development uses the unified launcher’s private same-origin
							bootstrap. Both keep the token out of URLs and browser storage.
						</p>
						<h2>Packaging boundary</h2>
						<p>
							Native packaging includes the engine runtime and browser assets.
							Check the repository’s Windows release handoff for the exact
							installer verification status. This browser session does not prove
							installed WebView behavior. The mobile companion is not
							implemented.
						</p>
					</>
				)}
				{path === "/docs/troubleshooting" && (
					<>
						<h2>Engine unavailable</h2>
						<p>
							Check that the local engine is running, its address is correct,
							and it explicitly allows your frontend origin. A CORS rejection
							can appear as a connection failure. No execution result is
							fabricated while disconnected.
						</p>
						<h2>Session rejected</h2>
						<p>
							Reconnect using the current private session token. It normally
							rotates when the engine restarts. Reloading the browser clears the
							memory-only token.
						</p>
						<h2>The submission response was lost</h2>
						<p>
							Choose Recover submission. Hardcase resends the original operation
							with its same idempotency key so the engine can return the
							existing run. Do not create a second test to recover a lost
							response.
						</p>
						<h2>Stopping takes a moment</h2>
						<p>
							Cancellation is asynchronous. The engine responds with HTTP 202,
							stops its owned workers, cleans up, and then publishes a terminal
							state. The UI waits for that state.
						</p>
						<h2>Graphics or motion issues</h2>
						<p>
							Enable Standard graphics in Settings to remove the optional GPU
							overlay. Reduced motion follows your system preference and can be
							forced in Settings. Evidence and forms do not depend on the GPU
							effect.
						</p>
						<h2>No findings</h2>
						<p>
							Check the run outcome and unexecuted scenario count. A failed run
							with zero results is not a clean result. In Investigate, choose
							All to see passing assertions.
						</p>
					</>
				)}
				<div className="docs-next">
					<span>Keep exploring</span>
					<a
						href={
							docs[
								(docs.findIndex((doc) => doc.path === path) + 1) % docs.length
							].path
						}
					>
						{
							docs[
								(docs.findIndex((doc) => doc.path === path) + 1) % docs.length
							].label
						}
						<ArrowRight size={16} />
					</a>
				</div>
			</article>
		</div>
	);
}
function Legal({ name }: { name: string }) {
	return (
		<article className="legal-page">
			<nav className="legal-nav" aria-label="Legal pages">
				{[
					["privacy", "Privacy"],
					["terms", "Terms"],
					["cookies", "Cookies & storage"],
					["contact", "Contact"],
				].map(([id, label]) => (
					<a
						key={id}
						className={name === id ? "active" : ""}
						href={`/legal/${id}`}
					>
						{label}
					</a>
				))}
			</nav>
			<h1>
				{name === "privacy"
					? "Privacy, in plain language."
					: name === "terms"
						? "Terms of use."
						: name === "cookies"
							? "A clear view of local storage."
							: "Get in touch."}
			</h1>
			<p className="legal-date">Local build notice · Updated 22 October 2026</p>
			{name === "privacy" && (
				<>
					<p className="docs-lead">
						This notice describes the current local hardcase build and the
						information it handles.
					</p>
					<h2>What stays on your device</h2>
					<p>
						Test configurations, execution history, assertion results, and
						artifacts are handled by the local engine. Its configured data and
						artifact directories retain that information until you remove it.
						Screenshots and traces can contain sensitive page data.
					</p>
					<h2>The frontend session</h2>
					<p>
						Your engine address and bearer token are held in frontend memory.
						The token is sent only to the configured loopback engine in an
						authorization header. It is not saved to local storage, a cookie, or
						a URL. Reloading the browser clears it. In the desktop shell, a
						configured launcher session file may supply it.
					</p>
					<h2>Preferences and website storage</h2>
					<p>
						The website stores your storage choice locally. With your opt-in, it
						also stores theme, graphics, and motion preferences. No analytics,
						advertising cookies, or remote tracking endpoint is included. Fonts
						and images are served with the application. See{" "}
						<a href="/legal/cookies">Cookies & storage</a> to manage this.
					</p>
					<h2>Network activity</h2>
					<p>
						The frontend calls the local engine you configure. A run sends
						requests to its explicitly approved local target or disposable
						fixture. The frontend sets AI use to false; it does not send
						evidence to an AI provider. This local build does not include
						accounts, cloud sync, pairing, or a remote collection service.
					</p>
					<h2>Exports and control</h2>
					<p>
						Reports are fetched from the engine’s export pipeline. Downloading
						an artifact creates a file under your control; clearing browser
						storage does not remove it. Review sensitive screenshots and traces
						before sharing them. Disconnect in Settings to clear the frontend’s
						engine credential.
					</p>
					<h2>Public distribution</h2>
					<p>
						If this build is hosted or distributed with additional services, the
						operator must publish the actual hosting, collection, retention, and
						contact details for that release. This notice does not claim privacy
						certification or legal compliance.
					</p>
				</>
			)}
			{name === "terms" && (
				<>
					<p className="docs-lead">
						hardcase is local engineering software for bounded application
						testing. These use conditions describe this application.
					</p>
					<h2>Authorized targets</h2>
					<p>
						Use hardcase only with applications you own or are explicitly
						permitted to test. Current support is limited to loopback targets
						and engine-owned disposable fixtures. Do not attempt to bypass
						target restrictions or use the software to access another person’s
						application or information.
					</p>
					<h2>Control your execution</h2>
					<p>
						Review the target, scenario, budget, and permissions before
						starting. Levels 3–5 require explicit fixture fault consent.
						Cancellation can take time while workers stop and cleanup finishes.
						Keep backups of any local application data you choose to test.
					</p>
					<h2>Understand the evidence</h2>
					<p>
						A completed run means execution finished. Passing assertions cover
						only the scenarios that ran; they do not establish that an
						application is safe, secure, or bug-free. Suggested remediation is a
						hypothesis until separately verified. Fixture policies and simulated
						counters do not prove production identity or billing behavior.
					</p>
					<h2>Handle data responsibly</h2>
					<p>
						You are responsible for the local data you provide, the targets you
						authorize, and the artifacts you export or share. Screenshots and
						traces may include sensitive content. Respect the rights of others
						and the licenses of the software and assets included with a
						distribution.
					</p>
					<h2>Use and distribution</h2>
					<p>
						This build may contain defects and does not include a service-level
						promise, hosted service, or paid support agreement. Public release
						terms, the distributing party’s legal identity, jurisdiction, and
						contact details must be supplied by that party before public
						distribution.
					</p>
				</>
			)}
			{name === "cookies" && (
				<>
					<p className="docs-lead">
						This build does not set application cookies. It can use browser
						local storage for the choices below.
					</p>
					<div className="docs-table-wrap">
						<table>
							<thead>
								<tr>
									<th>Key</th>
									<th>Purpose</th>
									<th>When saved</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td>
										<code>hardcase.storage.v1</code>
									</td>
									<td>
										Version, display-preference permission, and the timestamp of
										your choice.
									</td>
									<td>When you save a storage choice.</td>
								</tr>
								<tr>
									<td>
										<code>hardcase.preferences.v1</code>
									</td>
									<td>Theme, graphics mode, and reduced-motion setting.</td>
									<td>Only while optional preferences are allowed.</td>
								</tr>
							</tbody>
						</table>
					</div>
					<h2>Your choice</h2>
					<p>
						Essential only keeps a record of your choice and removes the
						optional preferences key. Changing display settings still works for
						the current page session. You can change this choice at any time
						using Storage preferences in the footer or workspace settings.
					</p>
					<button
						type="button"
						className="button primary"
						onClick={openPrivacyControls}
					>
						Manage storage preferences
						<ArrowRight size={16} />
					</button>
					<h2>Retention</h2>
					<p>
						These records remain in this browser profile until you clear site
						data or update the choice. They have no automatic expiry in this
						build. Engine tokens, run payloads, and evidence are not stored in
						browser local storage.
					</p>
					<h2>No tracking categories</h2>
					<p>
						Analytics and advertising are not implemented, so there are no
						switches suggesting those services are present. These controls do
						not govern separately installed browser extensions or a future
						hosting provider.
					</p>
				</>
			)}
			{name === "contact" && (
				<>
					<p className="docs-lead">
						For this local application, use the project maintainer’s contact
						channel supplied with your download or repository access.
					</p>
					<h2>Report a problem clearly</h2>
					<p>
						Include your operating system, frontend and engine versions, the
						action that failed, and a redacted error message. A run ID helps the
						maintainer understand the context, but does not grant them access to
						your local engine.
					</p>
					<h2>Keep credentials private</h2>
					<p>
						Do not send session tokens, private session files, raw traces, or
						screenshots containing sensitive page data in a public issue. Review
						artifacts before you share them.
					</p>
					<h2>Start with the documentation</h2>
					<p>
						Connection, execution, and graphics recovery steps are covered in{" "}
						<a href="/docs/troubleshooting">Troubleshooting</a>. This build does
						not include a hosted support form or a published support mailbox.
					</p>
				</>
			)}
		</article>
	);
}
function ErrorPage({ code }: { code: string }) {
	return (
		<section className="custom-error">
			<div className="error-landscape">
				<img src="/images/meadow-light.webp" alt="" />
				<span>{code}</span>
			</div>
			<div>
				<h1>
					{code === "404" ? "A path less travelled." : "A moment to reset."}
				</h1>
				<p>
					{code === "404"
						? "This page is not in the workspace. The path may have changed, or the address may be incomplete."
						: "This page could not be loaded. Try returning to the workspace or reloading the page."}
				</p>
				<div>
					<a className="button primary" href="/app">
						Back to the workspace
						<ArrowRight size={16} />
					</a>
					<a className="text-button" href="/docs">
						Open documentation
						<ArrowRight size={14} />
					</a>
				</div>
			</div>
		</section>
	);
}
