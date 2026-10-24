import type { ErrorInfo, ReactNode } from "react";
import { Component, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/manrope/wght.css";
import "@fontsource/fraunces/latin-400.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import Routes from "./Routes";
import "./styles.css";
import "./styles/motion.css";

class ErrorBoundary extends Component<
	{
		children: ReactNode;
	},
	{
		failed: boolean;
	}
> {
	state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	componentDidCatch(_error: Error, _info: ErrorInfo) {
		/* Sensitive run content must not be logged. */
	}
	render() {
		return this.state.failed ? (
			<main className="fatal-error">
				<h1>The workspace needs a fresh start.</h1>
				<p>
					Reload the frontend to recover. The local engine keeps its own run
					history.
				</p>
				<button
					type="button"
					className="button primary"
					onClick={() => window.location.reload()}
				>
					Reload workspace
				</button>
			</main>
		) : (
			this.props.children
		);
	}
}
const container = document.getElementById("root");
if (!container) throw new Error("Application mount is missing.");
createRoot(container).render(
	<StrictMode>
		<ErrorBoundary>
			<Routes />
		</ErrorBoundary>
	</StrictMode>,
);

import "./styles/fullscreen.css";
import "./styles/anchors.css";

import "./styles/privacy.css";
import "./styles/workspace-polish.css";

// Only the public, read-only build caches public assets. Private engine requests never enter this worker.
if (
	import.meta.env.VITE_HARDCASE_MODE === "recorded-demo" &&
	"serviceWorker" in navigator
) {
	window.addEventListener("load", () => {
		void navigator.serviceWorker.register("/sw.js").catch(() => {});
	});
}
