# Windows V1 release

Status: packaging acceptance in progress. See `RELEASE_COORDINATION.md` for the retained backend and Reviewboard checkpoints. Do not interpret compilation as installer or UI acceptance.

## Build and launch

From the canonical checkout:

```powershell
npm run desktop:build
```

The packager builds the API and web application, stages the exact installed runtime dependencies with Node and Chromium, and creates a current-user Windows x64 NSIS installer under a timestamped `release/hardcase-windows-x64-*/installer` directory. The adjacent `hardcase-runtime` folder is the portable local web application. Double-click `Start-Hardcase.cmd` or run `Start-Hardcase.ps1`, then open the printed local URL. No npm install or AI key is needed in that distribution.

The native app starts and stops its private engine automatically. Data is stored in `%LOCALAPPDATA%\dev.hardcase.desktop\engine`. The portable web default is `%LOCALAPPDATA%\hardcase\web`. Keep session credentials and raw authenticated traces private.

For source development use `npm run dev` (web) or `npm run desktop:dev` (native). Source development requires the documented Node/Rust/WebView2 build prerequisites; release users do not need the Rust compiler.

## Controlled MVP

Reviewboard source and scenario JSON are included in the portable runtime. It is a separate authenticated application. With a fresh data directory, start clean mode using the bundled `node.exe examples/reviewboard/server.mjs`. Add `--faulty` only for the intentional local permission-failure demonstration. See `examples/reviewboard/README.md` for synthetic credentials and the exact reproduction sequence.

## Verification commands

`node scripts/verify-runtime.mjs <runtime-directory>` checks bundled Node/Chromium execution with a restricted PATH. `node scripts/verify-desktop.mjs <installed-hardcase.exe>` drives the actual WebView2 window through preparation, all five fixture tiers, evidence, report download, replay, reload/history and window shutdown. CDP debugging is enabled only on that test process, bound to loopback, and is not shipped in app configuration.

## Distribution limits

Windows x64 is the packaged platform. The installer is unsigned. WebView2 must be available; the standard Tauri installer can bootstrap it if needed. The application remains local-first: owned loopback targets at levels 1–2, disposable fixtures at levels 1–5. No hosted public scanner, verified live AI integration, macOS installer or Linux installer is claimed.

Official packaging references: [Tauri resources](https://v2.tauri.app/develop/resources/), [Windows installers](https://v2.tauri.app/distribute/windows-installer/), [Playwright WebView2 testing](https://playwright.dev/docs/webview2).
