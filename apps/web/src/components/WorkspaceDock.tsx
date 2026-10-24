import {
	Activity,
	FileSearch,
	FlaskConical,
	History,
	LayoutGrid,
} from "lucide-react";
import * as m from "motion/react-m";
import type { WorkspacePage } from "./WorkspaceSidebar";

const destinations = [
	{ id: "overview", label: "Overview", icon: LayoutGrid },
	{ id: "prepare", label: "Prepare", icon: FlaskConical },
	{ id: "observe", label: "Observe", icon: Activity },
	{ id: "investigate", label: "Investigate", icon: FileSearch },
	{ id: "history", label: "History", icon: History },
] as const;
export function WorkspaceDock({
	page,
	onNavigate,
	still,
}: {
	page: WorkspacePage;
	onNavigate: (page: WorkspacePage) => void;
	still: boolean;
}) {
	return (
		<nav className="workspace-dock" aria-label="Workspace dock">
			{destinations.map((item) => (
				<button
					key={item.id}
					type="button"
					className={`dock-item ${page === item.id ? "active" : ""}`}
					onClick={() => onNavigate(item.id)}
					aria-label={item.label}
					aria-current={page === item.id ? "page" : undefined}
				>
					{page === item.id && (
						<m.span
							aria-hidden="true"
							className="dock-selection"
							layoutId="dock-selection"
							transition={
								still
									? { duration: 0 }
									: { type: "spring", stiffness: 420, damping: 38 }
							}
						/>
					)}
					<item.icon size={20} />
					<span className="dock-mobile-label">{item.label}</span>
				</button>
			))}
		</nav>
	);
}
