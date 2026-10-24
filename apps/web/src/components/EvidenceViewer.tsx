import { Download, FileCode2, Image, Shield, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { EngineClient } from "../api/client";
import type { Evidence } from "../api/types";
import { downloadBlob, formatBytes, messageOf } from "../lib/model";
import { Loading, Notice } from "./Primitives";
export function EvidenceViewer({
	evidence,
	client,
	connected,
}: {
	evidence: Evidence[];
	client: EngineClient | null;
	connected: boolean;
}) {
	const [selected, setSelected] = useState<Evidence | null>(null);
	const [preview, setPreview] = useState<{
		image?: string;
		text?: string;
	} | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [downloading, setDownloading] = useState<string | null>(null);
	const artifactIdentity = evidence.map((item) => item.id).join(",");
	useEffect(() => {
		void artifactIdentity;
		setSelected(null);
	}, [artifactIdentity]);
	useEffect(() => {
		setPreview(null);
		setError("");
		if (!selected || !client || !connected) return;
		if (selected.kind === "trace" || selected.bytes > 5 * 1048576) return;
		let disposed = false;
		let url: string | undefined;
		setBusy(true);
		void client
			.downloadEvidence(selected.runId, selected.id)
			.then(async (blob) => {
				if (disposed) return;
				if (
					selected.mediaType === "image/png" &&
					blob.type.startsWith("image/png")
				) {
					url = URL.createObjectURL(blob);
					setPreview({ image: url });
				} else if (
					selected.mediaType.includes("json") &&
					blob.size <= 5 * 1048576
				) {
					const text = await blob.text();
					if (!disposed) {
						let formatted = text;
						try {
							formatted = JSON.stringify(JSON.parse(text), null, 2);
						} catch {
							/* render untrusted data only as text */
						}
						setPreview({ text: formatted.slice(0, 150000) });
					}
				}
			})
			.catch((cause) => {
				if (!disposed) setError(messageOf(cause));
			})
			.finally(() => {
				if (!disposed) setBusy(false);
			});
		return () => {
			disposed = true;
			if (url) URL.revokeObjectURL(url);
		};
	}, [selected, client, connected]);
	async function download(item: Evidence) {
		if (!client || !connected) return;
		setDownloading(item.id);
		setError("");
		try {
			const blob = await client.downloadEvidence(item.runId, item.id);
			downloadBlob(
				blob,
				`${item.kind}-${item.id}.${item.kind === "screenshot" ? "png" : item.kind === "trace" ? "zip" : "json"}`,
			);
		} catch (cause) {
			setError(messageOf(cause));
		} finally {
			setDownloading(null);
		}
	}
	return (
		<div className="evidence-panel">
			<p className="privacy-note">
				<Shield size={15} />
				Screenshots and traces can contain page data. Artifacts stay local and
				require your engine session.
			</p>
			{error && <Notice tone="error">{error}</Notice>}
			<div className="artifact-list">
				{evidence.map((item) => (
					<div
						key={item.id}
						className={`artifact-row ${selected?.id === item.id ? "selected" : ""}`}
					>
						<button
							type="button"
							className="artifact-select"
							onClick={() => setSelected(item)}
							disabled={!connected}
						>
							{item.kind === "screenshot" ? (
								<Image size={19} />
							) : (
								<FileCode2 size={19} />
							)}
							<span>
								<strong>
									{item.kind} · attempt {item.attempt}
								</strong>
								<small>
									{formatBytes(item.bytes)} · {item.mediaType}
								</small>
							</span>
						</button>
						<button
							type="button"
							className="icon-button"
							aria-label={`Download ${item.kind} ${item.id}`}
							onClick={() => void download(item)}
							disabled={!connected || downloading === item.id}
						>
							<Download size={17} />
						</button>
					</div>
				))}
			</div>
			{!evidence.length && (
				<p className="subtle">No artifacts were supplied for this scenario.</p>
			)}
			{selected && (
				<section className="artifact-preview" aria-label="Artifact preview">
					<div className="section-heading">
						<h3>{selected.kind} preview</h3>
						<button
							type="button"
							className="icon-button"
							aria-label="Close artifact preview"
							onClick={() => setSelected(null)}
						>
							<X size={17} />
						</button>
					</div>
					{busy ? (
						<Loading label="Reading authenticated local artifact…" />
					) : preview?.image ? (
						<a
							href={preview.image}
							target="_blank"
							rel="noreferrer"
							aria-label="Open full screenshot"
						>
							<img
								src={preview.image}
								alt={`Recorded screenshot for ${selected.scenarioId}, attempt ${selected.attempt}`}
							/>
						</a>
					) : preview?.text ? (
						<textarea
							className="code-preview"
							aria-label="Artifact JSON"
							readOnly
							rows={12}
							value={preview.text}
						/>
					) : (
						<p className="subtle">
							{!connected
								? "Reconnect the engine to preview this artifact."
								: "Download this artifact to inspect it locally. Trace ZIPs and files over 5 MB are not rendered inline."}
						</p>
					)}
					<div className="artifact-integrity">
						<span>SHA-256 · supplied by engine</span>
						<code>{selected.sha256}</code>
					</div>
				</section>
			)}
		</div>
	);
}
