import {
	ArrowRight,
	Eye,
	EyeOff,
	Laptop,
	Leaf,
	Monitor,
	Moon,
	Plug,
	ShieldCheck,
	Sun,
	Unplug,
} from "lucide-react";
import { useState } from "react";
import type { Capabilities } from "../api/types";
import {
	CheckControl,
	Notice,
	PageHeader,
	Status,
} from "../components/Primitives";
import type { Preferences } from "../state/preferences";
import { openPrivacyControls } from "../state/privacy";
import type { Connection, Session } from "../state/useEngine";
export function Settings({
	session,
	connection,
	error,
	capabilities,
	preferences,
	setPreferences,
	onConnect,
	onDisconnect,
	native,
	onNativeSession,
}: {
	session: Session;
	connection: Connection;
	error: string;
	capabilities: Capabilities | null;
	preferences: Preferences;
	setPreferences: (preferences: Preferences) => void;
	onConnect: (session: Session) => void;
	onDisconnect: () => void;
	native: boolean;
	onNativeSession: () => void;
}) {
	const [origin, setOrigin] = useState(session.baseUrl);
	const [token, setToken] = useState("");
	const [visible, setVisible] = useState(false);
	return (
		<>
			<PageHeader
				title="Workspace settings"
				description="Make yourself at home. Keep your testing local."
			/>
			<div className="settings-layout">
				<section className="settings-section">
					<div className="settings-section-heading">
						<Plug size={21} />
						<div>
							<h2>Local engine</h2>
							<p>
								No sign-in is required. A local session authorizes access to
								your engine.
							</p>
						</div>
						<Status
							value={
								connection === "ready"
									? "ready"
									: connection === "connecting"
										? "connecting"
										: "disconnected"
							}
						/>
					</div>
					{error && (
						<Notice
							tone={
								connection === "offline" || connection === "error"
									? "error"
									: "info"
							}
						>
							{error}
						</Notice>
					)}
					<form
						onSubmit={(event) => {
							event.preventDefault();
							onConnect({
								baseUrl: origin.trim(),
								token: token.trim() || session.token,
							});
							setToken("");
							setVisible(false);
						}}
						className="connection-form"
					>
						<label htmlFor="engine-origin">Engine address</label>
						<input
							type="url"
							id="engine-origin"
							required
							value={origin}
							onChange={(event) => setOrigin(event.target.value)}
							spellCheck={false}
						/>
						<label htmlFor="engine-token">Local session token</label>
						<div className="token-input">
							<input
								id="engine-token"
								type={visible ? "text" : "password"}
								autoComplete="off"
								spellCheck={false}
								value={token}
								onChange={(event) => setToken(event.target.value)}
								placeholder={
									session.token
										? "Session token is held in memory"
										: "Paste your engine’s local session token"
								}
								maxLength={256}
							/>
							<button
								type="button"
								className="icon-button"
								aria-label={
									visible ? "Hide session token" : "Show session token"
								}
								onClick={() => setVisible((value) => !value)}
							>
								{visible ? <EyeOff size={17} /> : <Eye size={17} />}
							</button>
						</div>
						<p className="field-hint">
							The token stays in memory. It is never saved in browser storage,
							exported reports, or a URL. Reloading the browser clears it.
						</p>
						<div className="connection-actions">
							<button
								type="submit"
								className="button primary"
								disabled={connection === "connecting"}
							>
								{connection === "connecting"
									? "Connecting…"
									: connection === "ready"
										? "Reconnect engine"
										: "Connect engine"}
								<ArrowRight size={16} />
							</button>
							{connection === "ready" && (
								<button type="button" className="button" onClick={onDisconnect}>
									<Unplug size={15} />
									Disconnect
								</button>
							)}
							{native && (
								<button
									type="button"
									className="button"
									onClick={onNativeSession}
								>
									<Laptop size={16} />
									Use desktop session
								</button>
							)}
						</div>
					</form>
					<details className="connection-help">
						<summary>Connection setup</summary>
						<div>
							<p>
								The unified launcher starts the engine and connects the
								workspace automatically. Run <code>npm run dev</code> from the
								repository root for development, or <code>npm start</code> after
								building.
							</p>
							<p>
								The backend must explicitly allow this origin:{" "}
								<code>{window.location.origin}</code>. Its configuration uses{" "}
								<code>ENGINE_ALLOWED_ORIGINS</code>. CORS failures can look like
								an offline engine.
							</p>
							<p>
								The desktop launcher supplies its local session through the
								Tauri bridge. The manual address and token fields are recovery
								controls for a separately started engine. Session tokens stay in
								memory.
							</p>
						</div>
					</details>
				</section>
				<section className="settings-section">
					<div className="settings-section-heading">
						<Monitor size={21} />
						<div>
							<h2>Appearance & performance</h2>
							<p>Designed for long sessions, on your terms.</p>
						</div>
					</div>
					<div className="setting-row">
						<div>
							<h3>Color theme</h3>
							<p>Light is the default. Both themes keep evidence clear.</p>
						</div>
						<fieldset className="segmented" aria-label="Color theme">
							<button
								type="button"
								className={preferences.theme === "light" ? "active" : ""}
								aria-pressed={preferences.theme === "light"}
								onClick={() =>
									setPreferences({ ...preferences, theme: "light" })
								}
							>
								<Sun size={15} />
								Light
							</button>
							<button
								type="button"
								className={preferences.theme === "dark" ? "active" : ""}
								aria-pressed={preferences.theme === "dark"}
								onClick={() =>
									setPreferences({ ...preferences, theme: "dark" })
								}
							>
								<Moon size={15} />
								Dark
							</button>
						</fieldset>
					</div>
					<div className="setting-row">
						<div>
							<h3>Standard graphics</h3>
							<p>
								Use the supplied photograph without the interactive GPU overlay.
							</p>
						</div>
						<CheckControl
							checked={preferences.graphics === "standard"}
							onChange={(value) =>
								setPreferences({
									...preferences,
									graphics: value ? "standard" : "enhanced",
								})
							}
						>
							Enable GPU fallback
						</CheckControl>
					</div>
					<div className="setting-row">
						<div>
							<h3>Reduce motion</h3>
							<p>
								System preferences are always respected. You can also reduce
								motion here.
							</p>
						</div>
						<CheckControl
							checked={preferences.motion === "reduced"}
							onChange={(value) =>
								setPreferences({
									...preferences,
									motion: value ? "reduced" : "system",
								})
							}
						>
							Reduce motion
						</CheckControl>
					</div>
				</section>
				<section className="settings-section">
					<div className="settings-section-heading">
						<ShieldCheck size={21} />
						<div>
							<h2>Boundaries & capabilities</h2>
							<p>Execution support is determined by your connected engine.</p>
						</div>
					</div>
					{capabilities ? (
						<>
							<div className="engine-facts">
								<span>
									Engine <strong>{capabilities.version}</strong>
								</span>
								<span>
									API <strong>{capabilities.apiVersion}</strong>
								</span>
								<span>
									AI analysis <strong>Disabled in this workspace</strong>
								</span>
							</div>
							<ul className="restriction-list">
								{capabilities.restrictions.map((item) => (
									<li key={item}>
										<Leaf size={14} />
										{item}
									</li>
								))}
							</ul>
						</>
					) : (
						<p className="subtle">
							Connect to read actual capabilities and limits. This frontend does
							not infer endpoint availability.
						</p>
					)}
				</section>
				<section className="settings-section">
					<h2>Local storage</h2>
					<p className="subtle">
						Display settings are only remembered between visits if you allow
						optional preference storage. Your session token is always
						memory-only.
					</p>
					<button
						type="button"
						className="button"
						onClick={openPrivacyControls}
					>
						Storage preferences
					</button>
					<a
						className="text-button settings-docs-link"
						href="/docs"
						target="_blank"
						rel="noreferrer"
					>
						Open documentation
						<ArrowRight size={14} />
					</a>
				</section>
				<section className="settings-section shortcuts-section">
					<h2>Keyboard shortcuts</h2>
					<dl>
						<div>
							<dt>Open command menu</dt>
							<dd>
								<kbd>Ctrl</kbd> <kbd>K</kbd>
							</dd>
						</div>
						<div>
							<dt>Prepare / Observe / Investigate</dt>
							<dd>
								<kbd>Ctrl</kbd> <kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd>
							</dd>
						</div>
						<div>
							<dt>Submit test configuration</dt>
							<dd>
								<kbd>Ctrl</kbd> <kbd>Enter</kbd>
							</dd>
						</div>
						<div>
							<dt>Close command menu</dt>
							<dd>
								<kbd>Esc</kbd>
							</dd>
						</div>
					</dl>
				</section>
			</div>
		</>
	);
}
