import { useReducedMotion } from "motion/react";
import { lazy, Suspense, useState } from "react";
import type { Preferences } from "../state/preferences";

const ComputationalVeil = lazy(() => import("./effects/ComputationalVeil"));

export function Landscape({
	preferences,
	backdrop = false,
}: {
	preferences: Preferences;
	backdrop?: boolean;
}) {
	const reduced = useReducedMotion();
	const [failed, setFailed] = useState(false);
	return (
		<div
			className={`${backdrop ? "app-landscape" : "landscape"} ${failed ? "image-fallback" : ""}`}
			aria-hidden="true"
		>
			{!failed && (
				<img
					key={preferences.theme}
					src={`/images/meadow-${preferences.theme}.webp`}
					alt=""
					onError={() => setFailed(true)}
					fetchPriority={backdrop ? "high" : "auto"}
				/>
			)}
			{!backdrop &&
				preferences.graphics === "enhanced" &&
				preferences.motion !== "reduced" &&
				!reduced && (
					<Suspense fallback={null}>
						<ComputationalVeil intensity={0.2} />
					</Suspense>
				)}
			{!backdrop && (
				<>
					<div className="landscape-caption">
						<span>Same app.</span>
						<span>More perspectives.</span>
					</div>
					<span className="landscape-coordinate">
						A FRESH LOCAL ENVIRONMENT
					</span>
					<svg
						aria-hidden="true"
						className="landscape-reticle"
						viewBox="0 0 80 80"
					>
						<path
							d="M0 20V0h20M60 0h20v20M80 60v20H60M20 80H0V60M35 40h10M40 35v10"
							fill="none"
							stroke="currentColor"
						/>
					</svg>
				</>
			)}
		</div>
	);
}
