/* Adapted from Fluid Functionalism preset sa1FQfCxG4. MIT, Micka Touillaud.
 * Source/license and intentional product substitutions: design/FLUID-LICENSE.txt.
 * Fixed-open inset layout, vertical header/search, collapsible thread groups,
 * traveling hover, and horizontal footer. No sample identities or fake threads.
 */
import {
	Activity,
	ArrowUpRight,
	ChevronDown,
	ChevronRight,
	FileSearch,
	FlaskConical,
	History,
	LayoutGrid,
	Moon,
	Plus,
	Search,
	Settings2,
	ShieldCheck,
	Sun,
	X,
} from "lucide-react";
import * as m from "motion/react-m";
import { useRef, useState } from "react";
import { RECORDED_DEMO } from "../api/deployment";
import type { Run } from "../api/types";
import { isTerminal } from "../api/types";
import { targetLabel } from "../lib/model";
import type { Connection } from "../state/useEngine";
import { Brand } from "./Primitives";

export type WorkspacePage =
	| "overview"
	| "prepare"
	| "observe"
	| "investigate"
	| "history"
	| "settings";
const pages = [
	{ id: "prepare", name: "Prepare", icon: FlaskConical },
	{ id: "observe", name: "Observe", icon: Activity },
	{ id: "investigate", name: "Investigate", icon: FileSearch },
] as const;
export function WorkspaceSidebar({
	page,
	runId,
	history,
	connection,
	theme,
	onNavigate,
	onOpenRun,
	onCommands,
	onTheme,
	mobile,
	onClose,
}: {
	page: WorkspacePage;
	runId: string | null;
	history: Run[];
	connection: Connection;
	theme: "light" | "dark";
	onNavigate: (page: WorkspacePage) => void;
	onOpenRun: (id: string) => void;
	onCommands: () => void;
	onTheme: () => void;
	mobile: boolean;
	onClose: () => void;
}) {
	const [hover, setHover] = useState<string | null>(null);
	const sidebar = useRef<HTMLElement>(null);
	const connected = connection === "ready";
	const menu = useRef<HTMLDetailsElement>(null);
	return (
		<aside
			id="workspace-sidebar"
			ref={sidebar}
			className="sidebar fluid-sidebar"
			aria-label="Workspace sidebar"
			data-preset="saBErysbKa"
		>
			<div className="sidebar-brand-line">
				<a className="brand-button" href="/" aria-label="hardcase home">
					<Brand />
				</a>
				{mobile && (
					<button
						type="button"
						className="icon-button"
						onClick={onClose}
						aria-label="Close navigation"
					>
						<X size={18} />
					</button>
				)}
			</div>
			<details className="workspace-picker" ref={menu}>
				<summary>
					<span className="workspace-tile">
						<ShieldCheck size={18} />
					</span>
					<span>
						<strong>
							{RECORDED_DEMO ? "Recorded workspace" : "Local workspace"}
						</strong>
						<small>
							{RECORDED_DEMO
								? "Controlled fixture evidence"
								: "On this machine"}
						</small>
					</span>
					<ChevronDown size={15} />
				</summary>
				<div className="workspace-options">
					<span>
						<ShieldCheck size={15} /> Local workspace{" "}
						<span className="selected-check">Selected</span>
					</span>
					<button
						type="button"
						onClick={() => {
							if (menu.current) menu.current.open = false;
							onNavigate("settings");
						}}
					>
						<Settings2 size={15} /> Engine settings
					</button>
					<a href="/docs">
						<ArrowUpRight size={15} /> Documentation
					</a>
				</div>
			</details>
			<button type="button" className="sidebar-search" onClick={onCommands}>
				<Search size={16} />
				<span>Quick actions</span>
				<kbd>Ctrl K</kbd>
			</button>
			<button
				type="button"
				className="sidebar-new"
				onClick={() => onNavigate("prepare")}
			>
				<Plus size={17} />
				<span>New test</span>
				<kbd>Ctrl 1</kbd>
			</button>
			<div className="sidebar-scroll">
				<button
					type="button"
					className={`fluid-row overview-nav ${page === "overview" ? "active" : ""}`}
					aria-current={page === "overview" ? "page" : undefined}
					onClick={() => onNavigate("overview")}
				>
					<LayoutGrid size={18} />
					<span>All projects</span>
				</button>
				<details className="sidebar-section" open>
					<summary>
						Testing workflow <ChevronDown size={14} />
					</summary>
					<nav
						aria-label="Main navigation"
						onPointerLeave={() => setHover(null)}
					>
						{pages.map((item, index) => (
							<button
								key={item.id}
								type="button"
								className={`fluid-row ${page === item.id ? "active" : ""}`}
								aria-label={item.name}
								aria-current={page === item.id ? "page" : undefined}
								onPointerEnter={() => setHover(item.id)}
								onFocus={() => setHover(item.id)}
								onBlur={() => setHover(null)}
								onClick={() => onNavigate(item.id)}
							>
								{hover === item.id && (
									<m.span
										className="fluid-hover"
										layoutId="workflow-hover"
										transition={{ type: "spring", stiffness: 500, damping: 40 }}
									/>
								)}
								<item.icon size={18} />
								<span>{item.name}</span>
								<kbd>{index + 1}</kbd>
							</button>
						))}
					</nav>
				</details>
				<details className="sidebar-section recent-section" open>
					<summary>
						Recent runs <ChevronDown size={14} />
					</summary>
					<nav aria-label="Recent runs" onPointerLeave={() => setHover(null)}>
						{history.slice(0, 5).map((run) => (
							<button
								key={run.id}
								type="button"
								className={`fluid-row recent-run ${runId === run.id && (page === "observe" || page === "investigate") ? "active" : ""}`}
								onPointerEnter={() => setHover(run.id)}
								onClick={() => onOpenRun(run.id)}
								title={`${targetLabel(run)} · ${run.id} · ${run.state}`}
							>
								{hover === run.id && (
									<m.span
										className="fluid-hover"
										layoutId="recent-hover"
										transition={{ type: "spring", stiffness: 500, damping: 40 }}
									/>
								)}
								<span
									className={`run-dot ${run.state}`}
									data-live={!isTerminal(run.state)}
								/>
								<span>
									<strong>{targetLabel(run)}</strong>
									<small>
										{run.id.slice(0, 8)} · {run.state.replaceAll("_", " ")}
									</small>
								</span>
								<ChevronRight size={12} />
							</button>
						))}
						{!history.length && (
							<p className="sidebar-empty">Your local runs will appear here.</p>
						)}
						<button
							type="button"
							className={`fluid-row history-link ${page === "history" ? "active" : ""}`}
							aria-label="Run history"
							onClick={() => onNavigate("history")}
						>
							<History size={17} />
							<span>All run history</span>
							<ArrowUpRight size={13} />
						</button>
					</nav>
				</details>
			</div>
			<div className="fluid-sidebar-footer">
				<details className="engine-picker">
					<summary>
						<span className={`connection-light ${connection}`} />
						<span>
							<strong>
								{connected
									? RECORDED_DEMO
										? "Recorded examples loaded"
										: "Engine connected"
									: connection === "connecting"
										? "Checking engine"
										: "Engine not connected"}
							</strong>
							<small>
								{connected
									? RECORDED_DEMO
										? "Read-only public demonstration"
										: "Local session active"
									: "Open connection settings"}
							</small>
						</span>
						<ChevronDown size={13} />
					</summary>
					<div className="engine-options">
						<p>
							No account required. Your privileged engine session stays in
							memory.
						</p>
						<button type="button" onClick={() => onNavigate("settings")}>
							<Settings2 size={15} /> Connection settings
						</button>
						<a href="/docs/troubleshooting">
							Connection help <ArrowUpRight size={13} />
						</a>
					</div>
				</details>
				<button
					type="button"
					className="icon-button"
					aria-label="Settings"
					title="Settings"
					onClick={() => onNavigate("settings")}
				>
					<Settings2 size={17} />
				</button>
				<button
					type="button"
					className="icon-button"
					aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
					title="Switch theme"
					onClick={onTheme}
				>
					{theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
				</button>
			</div>
		</aside>
	);
}
