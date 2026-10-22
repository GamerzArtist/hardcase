# hardcase backend

A local adversarial application-testing engine. Real Chromium workflows and bounded HTTP strategies execute declared assertions against disposable fixtures or explicitly configured, user-owned loopback servers. AI is optional. This repository contains no product frontend, Tauri UI, cloud authentication, public-target scanner, or deployment.

## Start

Development prerequisites: Node **24.11 or later in the 24.x LTS line**, npm, and Git. Verified on Windows with Node 24.11.1. Node's built-in SQLite emits an experimental-feature warning on this runtime; no separate SQLite installation is needed.

```powershell
npm ci
npx playwright install chromium
npm run build
npm start
```

The API binds **127.0.0.1:4318**. Health: `GET /v1/health`. Startup writes a newly generated privileged token to `.engine/session.json`; the token is never printed. Keep that file private. Stop with Ctrl+C.

Run the complete judge demo, including clean/faulty five-level runs, SSE progress, reproduction, comparison, cancellation, and restart verification:

```powershell
npm run demo
```

This starts its own API on an ephemeral loopback port and shuts it down afterwards. Actual local outputs are saved under `.engine/demo/`; see `verification.json` and `artifacts/<run-id>/report.{json,md}`. No cloud account, API key, external target, or real financial operation is involved.

To manually start the disposable application:

```powershell
npm run fixture
# Or the fixed variant:
npm run fixture -- --clean
```

The standalone fixture listens on **127.0.0.1:4319**. Engine fixture runs create their own fresh isolated server and database; they do not reuse the standalone server.

## Verification

```powershell
npm run typecheck
npm test
npm run test:unit
npm run test:integration
npm run test:e2e
npm run api:spec
npm audit
```

`npm test` builds before running the full suite. Browser tests use the compiled worker and real Chromium. `npm run api:spec` regenerates the OpenAPI contract and labeled sample payloads. Tests use bounded synthetic data in `.test-data/`, removed after each test.

## Executable coverage

| Tier | Implementation | What execution proves |
|---|---|---|
| 1 — Normal | Real Chromium | Save/load, acknowledged-write persistence, links, refresh, back/forward, basic Tab focus, narrow layout, console/request observations |
| 2 — Chaos | Real Chromium plus bounded HTTP | Repeated submissions, two tabs, empty/long inputs, delayed pending writes, refresh/retry consistency |
| 3 — Hostile | Real local HTTP against synthetic policies | Viewer/admin enforcement, idempotent synthetic token charging, simulated quota and cost ceilings |
| 4 — Siege | Real capped local HTTP | Two request lanes at most, duplicate-event bursts, queue limits, throttling, rejection, measured latency and recovery |
| 5 — Breakpoint | Real local HTTP with in-process fixture faults | Dependency outages/timeouts, bounded retry exhaustion, failed-write rollback, concurrent recovery and persisted-state invariants |

Levels 3–5 require `allowFixtureFaults: true` and an **engine-created fixture**. Default runs select Levels 1–2. Synthetic dependency attempts, billing units and event volume are labeled; they are not real provider traffic or public load testing. The separate `actualNetworkRequests` counter counts actual engine requests.

The faulty fixture has seven failing scenarios; the clean fixture has eight passing scenarios. A failed fixture assertion is rerun once from reset state. Only repeated failure of the same assertion becomes `confirmed`; script failures are infrastructure errors, and policy/budget blocks are inconclusive.

## Repository map

```text
src/
  api/             authenticated v1 API, schemas, OpenAPI
  domain/          strict scenario/run/finding/event contracts
  orchestration/   FIFO queue, lifecycle, deadlines, crash handling
  workers/         isolated child process, ownership and cleanup
  browser/         Chromium context and bounded network proxy
  strategies/      eight recipes implementing five tiers
  assertions/      allowlisted assertion evaluation
  security/        target policy, request budgets, redaction
  fixtures/        clean/faulty SQLite application and CLI
  evidence/        local artifacts, hashes and stable IDs
  persistence/     durable SQLite snapshots and event log
  reporting/       JSON, Markdown and compatible-run comparisons
  ai/              optional bounded analysis-gateway adapter
  cli/             server, demonstration and contract generator
tests/             unit, API/process integration and real browser E2E
docs/              architecture, security, fixtures and handoff
```

Read [FRONTEND_HANDOFF.md](docs/FRONTEND_HANDOFF.md) for client integration, [ARCHITECTURE.md](docs/ARCHITECTURE.md) for process ownership, [SECURITY.md](docs/SECURITY.md) for boundaries, [FIXTURES.md](docs/FIXTURES.md) for independent defect triggers, and [ASTRA_SESSION_REPORT.md](docs/ASTRA_SESSION_REPORT.md) for executed verification and remaining limitations.
