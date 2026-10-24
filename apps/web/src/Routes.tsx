import { isTauri } from "@tauri-apps/api/core";
import { lazy, Suspense } from "react";
import { Loading } from "./components/Primitives";
import { PrivacyControls } from "./components/PrivacyControls";

const App = lazy(() => import("./App"));
const Site = lazy(() => import("./Site"));
export default function Routes() {
	const path = window.location.pathname.replace(/\/$/, "") || "/";
	const app = path === "/app" || path.startsWith("/app/") || isTauri();
	return (
		<>
			<Suspense
				fallback={
					<div className="route-loading">
						<Loading label="Opening hardcase…" />
					</div>
				}
			>
				{app ? <App /> : <Site path={path} />}
			</Suspense>
			<PrivacyControls showBanner={!app} />
		</>
	);
}
