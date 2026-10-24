import {
	Activity,
	ArrowRight,
	ChevronRight,
	Command,
	FileSearch,
	FlaskConical,
	History as HistoryIcon,
	LayoutGrid,
	Menu,
	Moon,
	PanelLeft,
	Plug,
	Search,
	ShieldCheck,
	Sun,
	X,
} from "lucide-react";
import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import * as m from "motion/react-m";
import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { localApplicationSession } from "./api/bootstrap";
import { EngineError } from "./api/client";
import { RECORDED_DEMO } from "./api/deployment";
import type { CreateRun, Run } from "./api/types";
import { isTerminal } from "./api/types";
import { Brand, Loading, Notice } from "./components/Primitives";
import { WorkspaceDock } from "./components/WorkspaceDock";
import {
	type WorkspacePage,
	WorkspaceSidebar,
} from "./components/WorkspaceSidebar";
import { DEFAULT_DRAFT, messageOf, requestFromDraft } from "./lib/model";
import { desktopSession, isDesktop } from "./platform/desktop";
import { History } from "./screens/History";
import { Investigate } from "./screens/Investigate";
import { Observe } from "./screens/Observe";
import { Prepare } from "./screens/Prepare";
import { RecordedExamples } from "./screens/RecordedExamples";
import { Settings } from "./screens/Settings";
import { usePreferences } from "./state/preferences";
import { useEngine, useRun } from "./state/useEngine";

type Page = WorkspacePage;
const Overview = lazy(() =>
	import("./screens/Overview").then((module) => ({ default: module.Overview })),
);
function routeState() {
	const query = new URLSearchParams(window.location.search);
	const requested = query.get("view");
	const page: Page = [
		"overview",
		"prepare",
		"observe",
		"investigate",
		"history",
		"settings",
	].includes(requested || "")
		? (requested as Page)
		: "prepare";
	const id = query.get("run");
	return { page, runId: id && /^[a-f0-9-]{36}$/i.test(id) ? id : null };
}
const nav = [
	{ id: "overview", name: "All projects", icon: LayoutGrid },
	{ id: "prepare", name: "Prepare", icon: FlaskConical },
	{ id: "observe", name: "Observe", icon: Activity },
	{ id: "investigate", name: "Investigate", icon: FileSearch },
	{ id: "history", name: "Run history", icon: HistoryIcon },
] as const;
export default function App() {
	const [page, setPage] = useState<Page>(() => routeState().page);
	const [preferences, setPreferences] = usePreferences();
	const [draft, setDraft] = useState(DEFAULT_DRAFT);
	const [runId, setRunId] = useState<string | null>(() => routeState().runId);
	const [preferredScenario, setPreferredScenario] = useState<string | null>(
		null,
	);
	const [busy, setBusy] = useState(false);
	const [replaying, setReplaying] = useState(false);
	const [cancelling, setCancelling] = useState(false);
	const [actionError, setActionError] = useState("");
	const [uncertain, setUncertain] = useState(false);
	const [mobileNav, setMobileNav] = useState(false);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [native, setNative] = useState(false);
	const [commandQuery, setCommandQuery] = useState("");
	const [platformError, setPlatformError] = useState("");
	const pending = useRef(false);
	const submission = useRef<
		| { key: string; input: CreateRun }
		| { key: string; parent: string; scenarioIds: string[] }
		| null
	>(null);
	const commandDialog = useRef<HTMLDialogElement>(null);
	const content = useRef<HTMLElement>(null);
	const engine = useEngine();
	const execution = useRun(engine.client, engine.connection === "ready", runId);
	const connected = engine.connection === "ready";
	const navigate = useCallback((next: Page) => {
		setPage(next);
		setMobileNav(false);
		commandDialog.current?.close();
		content.current?.scrollTo(0, 0);
	}, []);
	useEffect(() => {
		const url = new URL(window.location.href);
		url.searchParams.set("view", page);
		if (runId) url.searchParams.set("run", runId);
		else url.searchParams.delete("run");
		window.history.replaceState(null, "", url);
	}, [page, runId]);
	useEffect(() => {
		const restore = () => {
			const next = routeState();
			setPage(next.page);
			setRunId(next.runId);
			setMobileNav(false);
		};
		window.addEventListener("popstate", restore);
		return () => window.removeEventListener("popstate", restore);
	}, []);
	useEffect(() => {
		if (!mobileNav) return;
		const previous = document.activeElement as HTMLElement | null;
		const sidebar = document.querySelector<HTMLElement>(".fluid-sidebar");
		const elements = () =>
			Array.from(
				sidebar?.querySelectorAll<HTMLElement>(
					"button,a[href],summary,input",
				) || [],
			).filter(
				(el) => el.getClientRects().length && !el.hasAttribute("disabled"),
			);
		elements()[0]?.focus();
		const key = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setMobileNav(false);
				event.preventDefault();
			}
			if (event.key === "Tab") {
				const items = elements();
				const i = items.indexOf(document.activeElement as HTMLElement);
				if (event.shiftKey && i <= 0) {
					items.at(-1)?.focus();
					event.preventDefault();
				} else if (!event.shiftKey && i === items.length - 1) {
					items[0]?.focus();
					event.preventDefault();
				}
			}
		};
		window.addEventListener("keydown", key);
		return () => {
			window.removeEventListener("keydown", key);
			previous?.focus();
		};
	}, [mobileNav]);
	const openCommands = useCallback(() => {
		setCommandQuery("");
		commandDialog.current?.showModal();
	}, []);
	const loadDesktopSession = useCallback(async () => {
		try {
			const session = await desktopSession();
			if (session) engine.connect(session);
			else
				setPlatformError(
					"No desktop engine session was supplied by the launcher. Connect manually using the local session token.",
				);
		} catch {
			setPlatformError(
				"The desktop engine session could not be read. Check the launcher’s session path, or connect manually.",
			);
		}
	}, [engine.connect]);
	useEffect(() => {
		if (RECORDED_DEMO) return;
		void isDesktop().then((value) => {
			setNative(value);
			void (value ? desktopSession() : localApplicationSession())
				.then((session) => {
					if (session) engine.connect(session);
				})
				.catch(() => {
					if (value)
						setPlatformError(
							"Desktop session unavailable. You can connect manually in Settings.",
						);
				});
		});
	}, [engine.connect]);
	useEffect(() => {
		if (execution.run && isTerminal(execution.run.state)) {
			engine.remember(execution.run);
			setCancelling(false);
		}
	}, [execution.run, engine.remember]);
	useEffect(() => {
		const handle = (event: KeyboardEvent) => {
			if (
				["[", "]"].includes(event.key) &&
				window.innerWidth > 760 &&
				!(
					event.target instanceof HTMLElement &&
					event.target.closest('input,textarea,select,[contenteditable="true"]')
				)
			) {
				event.preventDefault();
				setSidebarCollapsed((value) => (event.key === "]" ? false : !value));
				return;
			}
			if (!(event.ctrlKey || event.metaKey)) return;
			if (event.key.toLowerCase() === "k") {
				event.preventDefault();
				if (commandDialog.current?.open) commandDialog.current.close();
				else openCommands();
			}
			if (["1", "2", "3"].includes(event.key)) {
				event.preventDefault();
				navigate(
					(["prepare", "observe", "investigate"] as Page[])[
						Number(event.key) - 1
					],
				);
			}
			if (
				event.key === "Enter" &&
				page === "prepare" &&
				!commandDialog.current?.open
			) {
				event.preventDefault();
				document
					.querySelector<HTMLFormElement>("#prepare-form")
					?.requestSubmit();
			}
		};
		window.addEventListener("keydown", handle);
		return () => window.removeEventListener("keydown", handle);
	}, [page, navigate, openCommands]);
	function opened(run: Run) {
		submission.current = null;
		setUncertain(false);
		engine.remember(run);
		setRunId(run.id);
		setPreferredScenario(null);
		setCancelling(false);
		navigate("observe");
	}
	async function start() {
		if (pending.current || !engine.client || !connected || uncertain) return;
		pending.current = true;
		setBusy(true);
		setActionError("");
		let submitted = false;
		try {
			const input = requestFromDraft(
				draft,
				engine.recipes,
				new URL(engine.session.baseUrl).port,
			);
			input.target = await engine.client.validateTarget(input.target);
			for (let index = 0; index < input.scenarios.length; index++)
				input.scenarios[index] = await engine.client.validateScenario(
					input.scenarios[index],
				);
			submitted = true;
			submission.current = { key: crypto.randomUUID(), input };
			opened(await engine.client.createRun(input, submission.current.key));
		} catch (error) {
			const unknown =
				submitted &&
				error instanceof EngineError &&
				["offline", "timeout", "contract"].includes(error.kind);
			setUncertain(unknown);
			if (!unknown) submission.current = null;
			setActionError(
				unknown
					? "The response was lost. Recover this submission using its original operation key to retrieve the same run."
					: messageOf(error),
			);
		} finally {
			pending.current = false;
			setBusy(false);
		}
	}
	async function reconcile() {
		if (pending.current || !engine.client || !connected || !submission.current)
			return;
		pending.current = true;
		setBusy(true);
		try {
			const operation = submission.current;
			const recovered =
				"input" in operation
					? await engine.client.createRun(operation.input, operation.key)
					: await engine.client.replay(
							operation.parent,
							operation.scenarioIds,
							operation.key,
						);
			opened(recovered);
			setActionError("");
		} catch (error) {
			setActionError(messageOf(error));
		} finally {
			pending.current = false;
			setBusy(false);
		}
	}
	async function cancel() {
		if (!engine.client || !execution.run || !connected || cancelling) return;
		setCancelling(true);
		setActionError("");
		try {
			const next = await engine.client.cancelRun(execution.run.id);
			execution.accept(next);
			execution.refresh();
		} catch (error) {
			setCancelling(false);
			setActionError(`Cancellation was not confirmed. ${messageOf(error)}`);
		}
	}
	async function replay(ids: string[]) {
		if (
			pending.current ||
			!engine.client ||
			!execution.run ||
			!connected ||
			uncertain
		)
			return;
		pending.current = true;
		setReplaying(true);
		setActionError("");
		try {
			const operation = {
				key: crypto.randomUUID(),
				parent: execution.run.id,
				scenarioIds: ids,
			};
			submission.current = operation;
			opened(await engine.client.replay(operation.parent, ids, operation.key));
		} catch (error) {
			const unknown =
				error instanceof EngineError &&
				["offline", "timeout", "contract"].includes(error.kind);
			setUncertain(unknown);
			if (!unknown) submission.current = null;
			setActionError(
				unknown
					? "The replay response was lost. Recover this submission with its original operation key."
					: messageOf(error),
			);
		} finally {
			pending.current = false;
			setReplaying(false);
		}
	}
	const investigate = (scenario?: string) => {
		setPreferredScenario(scenario || null);
		navigate("investigate");
	};
	const commands = [
		...nav.map((item) => ({
			title: item.name,
			detail:
				item.id === "prepare"
					? "Configure a new local test"
					: item.id === "history"
						? "Open durable run history"
						: `Open ${item.name.toLowerCase()} view`,
			icon: item.icon,
			action: () => navigate(item.id),
		})),
		{
			title: "Connect local engine",
			detail: "Workspace settings",
			icon: Plug,
			action: () => navigate("settings"),
		},
		{
			title: `Use ${preferences.theme === "light" ? "dark" : "light"} theme`,
			detail: "Switch appearance",
			icon: preferences.theme === "light" ? Moon : Sun,
			action: () => {
				setPreferences({
					...preferences,
					theme: preferences.theme === "light" ? "dark" : "light",
				});
				commandDialog.current?.close();
			},
		},
	].filter((item) =>
		`${item.title} ${item.detail}`
			.toLowerCase()
			.includes(commandQuery.toLowerCase()),
	);
	return (
		<LazyMotion features={domAnimation} strict>
			<MotionConfig
				reducedMotion={preferences.motion === "reduced" ? "always" : "user"}
				transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
			>
				<a className="skip-link" href="#main-content">
					Skip to workspace
				</a>

				<div
					className={`app-shell ${mobileNav ? "nav-open" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}
					data-platform={native ? "tauri" : "browser"}
				>
					<WorkspaceSidebar
						page={page}
						runId={runId}
						history={engine.history}
						connection={engine.connection}
						theme={preferences.theme}
						onNavigate={navigate}
						onOpenRun={(id) => {
							setRunId(id);
							setPreferredScenario(null);
							navigate("observe");
						}}
						onCommands={openCommands}
						onTheme={() =>
							setPreferences({
								...preferences,
								theme: preferences.theme === "light" ? "dark" : "light",
							})
						}
						mobile={mobileNav}
						onClose={() => setMobileNav(false)}
					/>

					{mobileNav && (
						<button
							type="button"
							className="nav-scrim"
							aria-label="Close navigation"
							onClick={() => setMobileNav(false)}
						/>
					)}
					<div className="workspace" inert={mobileNav || undefined}>
						<header className="topbar">
							<button
								type="button"
								className="icon-button desktop-sidebar-toggle"
								aria-label={
									sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
								}
								title={
									sidebarCollapsed ? "Expand sidebar ]" : "Collapse sidebar ["
								}
								aria-expanded={!sidebarCollapsed}
								aria-controls="workspace-sidebar"
								onClick={() => setSidebarCollapsed((value) => !value)}
							>
								<PanelLeft size={17} />
							</button>
							<button
								type="button"
								className="icon-button mobile-menu"
								aria-label={mobileNav ? "Close navigation" : "Open navigation"}
								onClick={() => setMobileNav((value) => !value)}
							>
								{mobileNav ? <X size={19} /> : <Menu size={19} />}
							</button>
							<div className="breadcrumb">
								<span>Workspace</span>
								<ChevronRight size={13} />
								<strong>
									{page === "overview"
										? "All projects"
										: page === "history"
											? "Run history"
											: page === "settings"
												? "Settings"
												: page === "prepare"
													? RECORDED_DEMO
														? "Recorded examples"
														: "New test"
													: page === "observe"
														? "Observe"
														: "Investigate"}
								</strong>
								{runId &&
									page !== "prepare" &&
									page !== "settings" &&
									page !== "history" && (
										<>
											<ChevronRight size={13} />
											<code>{runId.slice(0, 8)}</code>
										</>
									)}
							</div>
							<div className="topbar-actions">
								<button
									type="button"
									className="command-button"
									onClick={openCommands}
								>
									<Search size={15} />
									<span>Quick actions</span>
									<kbd>
										<Command size={10} /> K
									</kbd>
								</button>
								<button
									type="button"
									className="icon-button theme-toggle"
									aria-label={`Switch to ${preferences.theme === "light" ? "dark" : "light"} theme`}
									onClick={() =>
										setPreferences({
											...preferences,
											theme: preferences.theme === "light" ? "dark" : "light",
										})
									}
								>
									{preferences.theme === "light" ? (
										<Moon size={17} />
									) : (
										<Sun size={17} />
									)}
								</button>
							</div>
						</header>
						<main
							id="main-content"
							ref={content}
							className={`main-content page-${page}`}
							tabIndex={-1}
						>
							<div className="mobile-brand">
								<Brand />
								<span>Local testing workbench</span>
							</div>
							{platformError && (
								<Notice
									tone="error"
									action={
										<button
											type="button"
											className="icon-button"
											aria-label="Dismiss desktop notice"
											onClick={() => setPlatformError("")}
										>
											<X size={15} />
										</button>
									}
								>
									{platformError}
								</Notice>
							)}
							{actionError && page !== "prepare" && (
								<Notice
									tone="error"
									action={
										uncertain ? (
											<button
												type="button"
												className="button small"
												onClick={() => void reconcile()}
											>
												Recover submission
											</button>
										) : (
											<button
												type="button"
												className="icon-button"
												aria-label="Dismiss error"
												onClick={() => setActionError("")}
											>
												<X size={15} />
											</button>
										)
									}
								>
									{actionError}
								</Notice>
							)}
							<m.div
								key={page}
								initial={{ opacity: 0, y: 4 }}
								animate={{ opacity: 1, y: 0 }}
								className="page-content"
							>
								{page === "overview" && (
									<Suspense
										fallback={<Loading label="Opening project overview…" />}
									>
										<Overview
											history={engine.history}
											loading={engine.historyLoading}
											error={engine.historyError}
											connected={connected}
											hasMore={engine.hasMore}
											onRefresh={() =>
												void engine.refreshHistory().catch(() => {})
											}
											onMore={() =>
												void engine.refreshHistory(true).catch(() => {})
											}
											onConnect={() => navigate("settings")}
											onOpen={(id) => {
												setRunId(id);
												setPreferredScenario(null);
												navigate("observe");
											}}
											onPrepare={(run) => {
												if (run && !uncertain)
													setDraft({
														...DEFAULT_DRAFT,
														targetKind: run.request.target.kind,
														...(run.request.target.kind === "fixture"
															? { variant: run.request.target.variant }
															: {
																	baseUrl: run.request.target.baseUrl,
																	scenarioMode: "json",
																	scenarioJson: JSON.stringify(
																		run.request.scenarios,
																		null,
																		2,
																	),
																}),
														tier: Math.max(...run.request.levels) as
															| 1
															| 2
															| 3
															| 4
															| 5,
													});
												navigate("prepare");
											}}
										/>
									</Suspense>
								)}
								{RECORDED_DEMO && page !== "prepare" && (
									<Notice>
										Recorded demonstration · genuine controlled fixture
										evidence. Live testing, cancellation and replay require the
										local application.
									</Notice>
								)}
								{page === "prepare" && RECORDED_DEMO && (
									<RecordedExamples
										runs={engine.history}
										loading={engine.historyLoading}
										error={engine.historyError}
										onRetry={() => void engine.refreshHistory().catch(() => {})}
										onOpen={(id) => {
											setRunId(id);
											navigate("observe");
										}}
									/>
								)}
								{page === "prepare" && !RECORDED_DEMO && (
									<Prepare
										client={engine.client}
										draft={draft}
										setDraft={setDraft}
										recipes={engine.recipes}
										capabilities={engine.capabilities}
										connection={engine.connection}
										busy={busy}
										error={actionError}
										uncertain={uncertain}
										onStart={() => void start()}
										onConnect={() => navigate("settings")}
										onReconcile={() => void reconcile()}
										preferences={preferences}
									/>
								)}
								{page === "observe" && (
									<Observe
										run={execution.run}
										recipes={engine.recipes}
										events={execution.events}
										loading={execution.loading}
										error={execution.error}
										connected={connected}
										stream={execution.stream}
										cancelling={cancelling}
										onCancel={() => void cancel()}
										onRetry={connected ? execution.refresh : engine.reconnect}
										onPrepare={() => navigate("prepare")}
										onInvestigate={investigate}
									/>
								)}
								{page === "investigate" && (
									<Investigate
										run={execution.run}
										loading={execution.loading}
										error={execution.error}
										connected={connected}
										client={engine.client}
										preferredScenario={preferredScenario}
										replaying={replaying}
										onReplay={(ids) => void replay(ids)}
										onObserve={() => navigate("observe")}
										onPrepare={() => navigate("prepare")}
									/>
								)}
								{page === "history" && (
									<History
										history={engine.history}
										loading={engine.historyLoading}
										error={engine.historyError}
										connected={connected}
										hasMore={engine.hasMore}
										onRefresh={() =>
											void engine.refreshHistory().catch(() => {})
										}
										onMore={() =>
											void engine.refreshHistory(true).catch(() => {})
										}
										onOpen={(id) => {
											setRunId(id);
											setPreferredScenario(null);
											navigate("observe");
										}}
										onPrepare={() => navigate("prepare")}
										onConnect={() => navigate("settings")}
									/>
								)}
								{page === "settings" && (
									<Settings
										session={engine.session}
										connection={engine.connection}
										error={engine.connectionError}
										capabilities={engine.capabilities}
										preferences={preferences}
										setPreferences={setPreferences}
										onConnect={engine.connect}
										onDisconnect={engine.disconnect}
										native={native}
										onNativeSession={() => void loadDesktopSession()}
									/>
								)}
							</m.div>
						</main>
						<WorkspaceDock
							page={page}
							onNavigate={navigate}
							still={
								preferences.motion === "reduced" ||
								preferences.graphics === "standard"
							}
						/>
						<footer className="statusbar">
							<span>
								<span className={`connection-light ${engine.connection}`} />
								{connected
									? RECORDED_DEMO
										? "Recorded examples loaded"
										: "Connected to local engine"
									: engine.connection === "connecting"
										? "Checking connection…"
										: "Local workspace · engine disconnected"}
							</span>
							<span>
								<ShieldCheck size={12} />
								{RECORDED_DEMO ? "Public controlled records" : "Local data"}
								<span className="statusbar-separator">/</span>
								{preferences.graphics === "standard"
									? "Standard graphics"
									: "Enhanced graphics"}
								<span className="statusbar-version">hardcase 0.1</span>
							</span>
						</footer>
					</div>
				</div>
				<dialog
					className="command-dialog"
					ref={commandDialog}
					onClick={(event) => {
						if (event.target === commandDialog.current)
							commandDialog.current.close();
					}}
					onKeyDown={(event) => {
						if (event.key === "Escape") commandDialog.current?.close();
						if (
							!event.defaultPrevented &&
							["ArrowDown", "ArrowUp"].includes(event.key)
						) {
							const items = Array.from(
								commandDialog.current?.querySelectorAll<HTMLButtonElement>(
									".command-result",
								) || [],
							);
							const index = items.indexOf(
								document.activeElement as HTMLButtonElement,
							);
							if (index >= 0 && items.length) {
								event.preventDefault();
								items[
									(index +
										(event.key === "ArrowDown" ? 1 : -1) +
										items.length) %
										items.length
								].focus();
							}
						}
					}}
					aria-label="Command menu"
				>
					<div className="command-search">
						<Search size={19} />
						<label className="sr-only" htmlFor="command-search">
							Find a command
						</label>
						<input
							id="command-search"
							value={commandQuery}
							onChange={(event) => setCommandQuery(event.target.value)}
							placeholder="Where would you like to go?"
							onKeyDown={(event) => {
								if (event.key === "Enter" && commands[0]) {
									event.preventDefault();
									event.stopPropagation();
									commands[0].action();
								}
								if (event.key === "ArrowDown") {
									event.preventDefault();
									commandDialog.current
										?.querySelector<HTMLButtonElement>(".command-result")
										?.focus();
								}
							}}
						/>
						<button
							type="button"
							className="icon-button"
							onClick={() => commandDialog.current?.close()}
							aria-label="Close command menu"
						>
							<X size={17} />
						</button>
					</div>
					<div className="command-results">
						<span className="command-section-label">Go to workspace</span>
						{commands.map((item) => (
							<button
								type="button"
								key={item.title}
								className="command-result"
								onClick={item.action}
							>
								<item.icon size={18} />
								<span>
									<strong>{item.title}</strong>
									<small>{item.detail}</small>
								</span>
								<ArrowRight size={16} />
							</button>
						))}
						{!commands.length && (
							<p className="subtle">No commands match your search.</p>
						)}
					</div>
					<div className="command-footer">
						<span>Tab to navigate · Enter to select</span>
						<kbd>Esc to close</kbd>
					</div>
				</dialog>
			</MotionConfig>
		</LazyMotion>
	);
}
