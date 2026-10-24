# Hardcase integrated application handoff

Canonical root: `D:\Code stuff\HACKATHON-PROJECTS\TEAM\hackathon-project-02`. Branch: `codex/hardcase-release`. Public source: https://github.com/GamerzArtist/hardcase. The old sibling frontend is preserved and is not the release root.

The React workspace is `apps/web`; engine source is `src`; runtime/shared schemas are represented by the typed adapter in `apps/web/src/api`. Provisional assumptions and target boundaries are documented in `FRONTEND_API_REQUIREMENTS.md`. No separate backend startup or token copying is required.

- Development: `npm ci`, `npx playwright install chromium`, `npm run dev`.
- Production local web: `npm run build`, `npm start`.
- Windows package: `npm run desktop:build`.
- Public recorded site: `npm run build:demo`, deployed using `vercel.json`.

The live launcher serves frontend routes and proxies `/api/v1/*`, SSE, reports and authenticated artifacts through one origin. `/healthz` checks the private worker, storage and Chromium. Startup readiness, memory-only session bootstrap and graceful shutdown were tested. The native bridge bundles Node/Chromium and automatically starts/stops its private engine.

Verified: 55 engine tests, 24 frontend unit tests, eight actual browser workflow tests, seven ingress assertions, real WebView2 five-tier run/evidence/export/replay/history/shutdown, and bundled runtime execution with PATH restricted to System32. See `verification/frontend-release/` and `HARDCASE_FINAL_RELEASE.md` for current results.

Unified readiness: VERIFIED for local web and native execution; public Vercel is a PARTIAL, explicitly read-only controlled demonstration. A publicly hosted live runner requires authenticated gateway deployment, durable storage, long-running browser workers and lifecycle isolation; that infrastructure is not provisioned. Docker configuration exists but was not built on this machine. No further Astra patch is required for the supported local workflow. No iOS/Android or remote controlling app is included.
