# Hardcase final release — 24 October 2026

## Application and source

Canonical repository: `D:\Code stuff\HACKATHON-PROJECTS\TEAM\hackathon-project-02`, branch `codex/hardcase-release`. Public GitHub: https://github.com/GamerzArtist/hardcase. Production: https://hardcase.vercel.app. Downloads: https://hardcase.vercel.app/downloads. The deployed commit is recorded by Vercel deployment metadata; use `git rev-parse HEAD` for the current documentation checkpoint.

## VERIFIED

- One-command local web application: `npm ci`; `npx playwright install chromium`; `npm run dev`. Production: `npm run build && npm start`. Frontend and private engine share one user-facing origin using `/api/v1/*`; startup, readiness, session bootstrap, SSE, reports, artifacts and shutdown are integrated.
- Prepare → actual Chromium execution → Observe → Investigate → authenticated PNG → reproduction → replay → JSON/Markdown export → durable history. Clean all-tier fixture: eight passing scenarios. Intentionally faulty all-tier fixture: seven confirmed findings from eight scenarios. Separate controlled Reviewboard custom JSON scenarios also executed.
- 55 backend tests / 10 files; 24 frontend tests / two files; eight browser workflow tests; seven public-ingress assertions. Latest browser run passed after the release landing changes. Lint, TypeScript and production builds passed.
- Actual Windows WebView2 acceptance: native engine bootstrap, five-tier execution, real screenshot, report export, fresh fixture replay, reload/history and clean shutdown. Bundled Node/Chromium also passed with PATH limited to Windows System32. Machine-readable proof: `verification/frontend-release/`.
- Whole landing page inspected at desktop 1440×1000 and mobile 390×844. Hero preserved; lower-page rhythm, evidence-chain interaction and night-scene/footer continuity refined. Sidebar collapse, command palette, custom controls and mobile navigation tested.
- Public recorded adapter uses genuine controlled run records. Evidence preview, report download and previously visited offline report passed locally. No simulated live runs are offered in this build.
- 2m19s functional demonstration recorded from actual local execution, with readable explanatory captions and no narration: `release/media/hardcase-functional-demo.mp4` (H.264) and `.webm`. Separate cinematic film is an additional artifact and does not replace this demonstration.

## Security evidence and limits

Existing defensive tests cover authenticated API/artifacts, scoped origins, loopback ownership, redirects/DNS/IP target policy, bounded budgets/concurrency, cancellation/cleanup, durable duplicate-start recovery and redaction. Public ingress rejects missing gateway authorization and cross-origin bootstrap. Browser sessions are held in memory. No public adversarial engine is exposed on Vercel. 283 working text files and 254 historical text blobs were checked for common secret/private-key patterns with zero matches; this is a targeted scan, not proof of absence or an independent security certification. Raw traces and local runtime data are excluded from public demo assets.

## PARTIAL

- Public deployment is an explicitly read-only demonstration. Full live browser execution is supported locally; authenticated durable cloud runner infrastructure is not provisioned. Docker configuration is present but not built here.
- Windows x64 NSIS installer built successfully after shortening the Chromium staging path. Current package: `release/hardcase-windows-x64-2026-10-24T04-14-33-199Z/installer/hardcase_0.1.0_x64-setup.exe`. The binary is unsigned; WebView2 is required. Installed-package verification and public asset checks are recorded in the final release checkpoint when completed.
- Optional public PWA caches public records only. It is not a remote controlling application. No private API or authorization-bearing request is cached by its worker.
- Bencho was researched as a reference; no unverified proprietary component source was copied. Existing Motion/Lucide/Recharts integrations remain; React Bits source provenance and license notices are retained. No Tripo 3D model was supplied or integrated.

## NOT IMPLEMENTED

iOS/Android native applications, remote mobile controlling/sign-in, cloud project sync, unrestricted network/public targets, autonomous AI exploration, verified live AI-provider integration, signed Windows distribution, macOS/Linux installers. Passing scenarios do not establish universal correctness or security.

## Demonstrate and submit

1. Open the public site and recorded examples, or install Windows/start the local app for live testing.
2. Prepare the faulty Notes fixture, select Breakpoint and explicitly allow disposable-fixture faults.
3. Run, observe eight actual scenarios, investigate the persistence finding, open its screenshot and reproduction instructions, replay, export and revisit history.
4. Explain the distinction between public recorded evidence and local live execution.
5. Upload the 2m19s functional MP4 to an accessible video platform, then paste that video URL, the public repository, public site and `devpost-submission.md` copy into Devpost. Final submission belongs to the owner. Official event deadline: 24 October, 10:30 AM IST. No user interviews or adoption metrics are claimed.

Usage checkpoint before release media: 80% primary used, 20% remaining; one banked reset preserved. No paid infrastructure or credits purchased. See media rendering report for final usage and video status.
