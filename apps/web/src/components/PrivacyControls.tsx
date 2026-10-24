import { ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { readConsent, saveConsent } from "../state/privacy";
import { CheckControl } from "./Primitives";
export function PrivacyControls({ showBanner }: { showBanner: boolean }) {
	const [decided, setDecided] = useState(() => !!readConsent());
	const [preferences, setPreferences] = useState(
		() => !!readConsent()?.preferences,
	);
	const dialog = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		const open = () => {
			setPreferences(!!readConsent()?.preferences);
			dialog.current?.showModal();
		};
		window.addEventListener("hardcase:open-privacy", open);
		return () => window.removeEventListener("hardcase:open-privacy", open);
	}, []);
	function choose(allow: boolean) {
		saveConsent(allow);
		setPreferences(allow);
		setDecided(true);
		dialog.current?.close();
	}
	return (
		<>
			{showBanner && !decided && (
				<aside
					className="privacy-banner"
					aria-label="Local storage preferences"
				>
					<ShieldCheck size={20} />
					<div>
						<strong>Your workspace. Your preferences.</strong>
						<p>
							This build has no analytics or advertising cookies. Optional local
							storage can remember your display settings.{" "}
							<a href="/legal/cookies">How storage works</a>
						</p>
					</div>
					<div className="privacy-actions">
						<button
							type="button"
							className="button small"
							onClick={() => choose(false)}
						>
							Reject optional
						</button>
						<button
							type="button"
							className="button small"
							onClick={() => dialog.current?.showModal()}
						>
							Customize
						</button>
						<button
							type="button"
							className="button primary small"
							onClick={() => choose(true)}
						>
							Accept all
						</button>
					</div>
				</aside>
			)}
			<dialog
				ref={dialog}
				className="privacy-dialog"
				aria-labelledby="privacy-title"
			>
				<div className="section-heading">
					<h2 id="privacy-title">Your storage preferences</h2>
					<button
						type="button"
						className="icon-button"
						aria-label="Close storage preferences"
						onClick={() => dialog.current?.close()}
					>
						<X size={18} />
					</button>
				</div>
				<p>
					No analytics, advertising, or third-party tracking is included in this
					build. There are no application cookies. These controls apply to
					browser local storage.
				</p>
				<section>
					<h3>
						Storage choice <span>Always available</span>
					</h3>
					<p>
						A small record remembers this choice so we do not ask on every
						visit. It contains a version, a preference setting, and a timestamp.
					</p>
				</section>
				<section>
					<CheckControl checked={preferences} onChange={setPreferences}>
						Remember display preferences
					</CheckControl>
					<p>
						Save your theme, graphics mode, and reduced-motion setting between
						visits. With this off, changes last for the current page session.
					</p>
				</section>
				<p className="field-hint">
					Your engine token is always memory-only. Changing this choice does not
					remove engine run history or downloaded files.
				</p>
				<div className="privacy-dialog-actions">
					<button
						type="button"
						className="button"
						onClick={() => choose(false)}
					>
						Reject optional
					</button>
					<button
						type="button"
						className="button primary"
						onClick={() => choose(preferences)}
					>
						Save my choice
					</button>
				</div>
				<a href="/legal/cookies">Read the storage notice</a>
			</dialog>
		</>
	);
}
