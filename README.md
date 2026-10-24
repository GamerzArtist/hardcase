# hardcase

One local-first application for bounded adversarial application testing. The React/TypeScript workspace, Node testing engine, Chromium runner and durable SQLite history share one repository and one web entry point. No account is required locally.

## Run the application

Node 24.11–24.x, npm and Git are required.

```powershell
npm ci
npx playwright install chromium
npm run dev
```

Open http://127.0.0.1:4327/app. The root launcher starts and stops the engine, configures its local origins and supplies a memory-only session automatically. Browser calls use `/api/v1/*` on the same origin. Do not start a separate frontend or manually copy a session token.

For production web execution:

```powershell
npm run build
npm start
```

`HARDCASE_WEB_PORT` changes the entry port. `ENGINE_DATA_DIR` selects the durable database/artifact directory. `/healthz` checks engine storage, worker and Chromium readiness. Stop with Ctrl+C. Native Windows packaging is documented in `docs/WINDOWS_RELEASE.md`; its acceptance is separate from browser verification.

## Test and deploy

```powershell
npm run lint
npm run typecheck
npm run test:web
npm run test:browser
```

Backend verification remains available with `npm run test:api` and `npm run demo`. See `docs/UNIFIED_DEPLOYMENT.md` for the container workflow and authenticated public ingress requirements. A static host cannot run this application. No public deployment has been performed by this sprint.

## Workflow and boundaries

Prepare → Run → Observe → Investigate → Reproduce → Export uses real engine records. Included clean/faulty fixtures support all five levels. Owned HTTP loopback apps support levels 1–2 with explicit scenarios and ownership acknowledgment. Higher-level faults remain fixture-only. No public-target scanner, cloud project sync, mobile companion or automatic AI exploration is claimed.

`apps/web` is the frontend workspace; `src` is Astra's testing engine; `examples/reviewboard` is the independently owned controlled test application. The old sibling frontend checkout is preserved but is not the release root. API contracts are in `docs/API_CONTRACT.md`, `docs/FRONTEND_HANDOFF.md` and `apps/web/src/api`. Current delivery evidence and limitations: `docs/SOL_FINAL_HANDOFF.md`.
