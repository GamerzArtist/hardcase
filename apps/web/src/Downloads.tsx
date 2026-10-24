import { ArrowUpRight } from "lucide-react";
import "./downloads.css";

export default function Downloads() {
	return (
		<div className="downloads-page">
			<div className="downloads-intro">
				<span className="document-caption">HARDCASE / WINDOWS RELEASE</span>
				<h1>
					Your tests.
					<br />
					<em>Your machine.</em>
				</h1>
				<p>
					The complete application bundles the workspace, local engine and
					Chromium. No sign-in or AI key is required for the supported testing
					workflow.
				</p>
			</div>
			<section className="download-release">
				<div>
					<h2>Hardcase for Windows</h2>
					<p>Version 0.1.0 · Windows x64 · unsigned installer</p>
					<a
						className="button primary"
						href="https://github.com/GamerzArtist/hardcase/releases/download/v0.1.0/hardcase_0.1.0_x64-setup.exe"
					>
						Download for Windows <ArrowUpRight size={16} />
					</a>
					<p className="download-detail">
						The application starts its private engine automatically. Run data
						stays on your computer. Windows may ask you to review the unsigned
						publisher.
					</p>
					<a
						className="editorial-link"
						href="https://github.com/GamerzArtist/hardcase/releases/tag/v0.1.0"
					>
						Release notes and checksums <ArrowUpRight size={14} />
					</a>
				</div>
				<div>
					<h2>Build from source</h2>
					<p>
						One repository. One command to start the web workspace and engine.
					</p>
					<pre>
						<code>
							{"npm ci\nnpx playwright install chromium\nnpm run dev"}
						</code>
					</pre>
					<a
						className="editorial-link"
						href="https://github.com/GamerzArtist/hardcase"
					>
						View the public repository <ArrowUpRight size={14} />
					</a>
				</div>
			</section>
			<section className="download-scope">
				<h2>Choose the right version</h2>
				<dl>
					<div>
						<dt>Windows / local web</dt>
						<dd>
							Live browser tests, cancellation, replay, history, authenticated
							evidence and exports. Owned loopback applications support levels
							1–2; disposable fixtures support all five.
						</dd>
					</div>
					<div>
						<dt>Public website</dt>
						<dd>
							Read-only, genuine recorded fixture tests. Inspect findings,
							screenshots and report exports. No hosted testing engine is
							exposed.
						</dd>
					</div>
					<div>
						<dt>iOS & Android</dt>
						<dd>
							Not included in this release. Remote mobile control and
							account-based access are not implemented.
						</dd>
					</div>
				</dl>
			</section>
		</div>
	);
}
