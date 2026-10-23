# hardcase frontend integration handoff

This document describes the backend in the canonical `hackathon-project-02` repository. The release now integrates the frontend under `apps/web`; current additions are in [API_CONTRACT.md](API_CONTRACT.md). Backend/API/browser verification remains distinct from frontend and native acceptance; see the current release verification documents.

## Start and connect

```powershell
npm ci
npx playwright install chromium
npm run build:api
$env:ENGINE_ALLOWED_ORIGINS = 'http://127.0.0.1:5173'
npm run start:api
```

The default API is `http://127.0.0.1:4318`; standalone fixture is `http://127.0.0.1:4319`. Fixture runs allocate their own ephemeral origins. Health is `GET /v1/health` and returns `{ "ok": true, "version": "0.1.0" }`.

The local process writes `{ origin, token, apiVersion, pid }` to `<ENGINE_DATA_DIR>/session.json`. Never commit, display, transmit to a remote service or put this token in a URL. A desktop host can read its own private session file and pass the credential to its local client. A development browser frontend needs an explicit local setup step to receive the token, held in memory. Every privileged request uses `Authorization: Bearer <local-session-token>`. No cloud identity is required. Tokens rotate on restart unless explicitly configured by the local operator.

CORS defaults to deny. `ENGINE_ALLOWED_ORIGINS` is a comma-separated list of exact local origins; `localhost` and `127.0.0.1` are different browser origins. Supported explicit desktop origins include `tauri://localhost` and `http://tauri.localhost`. No wildcard or credentialed cookie session is used. Requests with an unapproved Origin or Host receive 403.

## Source of truth

- `src/domain/models.ts`: TypeScript and strict Zod contracts for targets, scenarios, runs, results, artifacts and events.
- `src/api/contracts.ts`: API schemas and OpenAPI generator.
- `docs/openapi.json`: generated OpenAPI 3.1 specification, including request/response schemas, optional properties, defaults, limits and error responses.
- `docs/samples/create-run.request.sample.json` and `docs/samples/finding.sample.json`: **sample only**, generated and schema-validated by `npm run api:spec`. Placeholder IDs/timings are not real runtime results.

## Routes

All paths below are relative to the local API origin. Except health, all require the Bearer token. Request/response schema names refer to the generated OpenAPI components.

| Method | Path | Request / response |
|---|---|---|
| GET | `/v1/health` | `Health`; no auth |
| GET | `/v1/ready` | authenticated dependency readiness; `Readiness`,200 or503 |
| GET | `/v1/capabilities` | `Capabilities`; tiers, safety restrictions and hard caps |
| POST | `/v1/targets/validate` | `Target` → canonical `Target`; no execution |
| GET | `/v1/recipes` | `Recipe[]`; versioned executable fixture scenarios |
| GET | `/v1/scenarios/schema` | JSON Schema for allowlisted custom scenarios |
| POST | `/v1/scenarios/validate` | `Scenario` → validated `Scenario`; includes semantic checks |
| POST | `/v1/runs` | `CreateRun` → `Run`, HTTP 202 |
| GET | `/v1/runs?limit=50&offset=0` | newest-first `Run[]`; limit 1–100, offset 0–1,000,000 |
| GET | `/v1/runs/{id}` | `Run`, including progress, results, metrics and evidence |
| GET | `/v1/runs/{id}/events?after=0` | authenticated SSE; `Event` payloads |
| GET | `/v1/runs/{id}/events/poll?after=0&limit=100` | bounded `EventPage`; resume with nextCursor |
| POST | `/v1/runs/{id}/cancel` | empty body or `{}` → `Run`, HTTP 202; idempotent |
| GET | `/v1/runs/{id}/findings` | `ScenarioResult[]`, including passed/inconclusive cases |
| GET | `/v1/runs/{id}/evidence` | `Evidence[]` metadata |
| GET | `/v1/runs/{id}/evidence/{artifactId}` | PNG, ZIP or JSON bytes; authenticated attachment |
| GET | `/v1/runs/{id}/report?format=json` | `Report`; `format=markdown` downloads readable Markdown |
| GET | `/v1/runs/{id}/report?compareTo={id}` | report with an explicit compatible baseline |
| POST | `/v1/runs/{id}/replay` | `{ "scenarioIds": ["normal.persistence"] }` → new `Run`, 202 |
| POST | `/v1/compare` | `{ "before": "<uuid>", "after": "<uuid>" }` → `Comparison` |
| GET | `/v1/openapi.json` | complete generated API contract |

Error body: `{ "error": "REQUEST_REJECTED", "message": "human-readable reason" }`. HTTP 400 means invalid input/policy; 401 missing or invalid local token; 403 forbidden Host/Origin/path; 404 unknown run/artifact/route; 409 incompatible comparison or ineligible lifecycle; 429 full queue or too many streams; 500 unexpected engine failure (`INTERNAL_ERROR`). Unknown routes return `NOT_FOUND`. Do not treat a successful HTTP response as evidence of application correctness.

## Create the fixture run

**Sample request, not runtime data:**

```json
{
  "target": { "kind": "fixture", "variant": "faulty" },
  "levels": [1, 2, 3, 4, 5],
  "allowFixtureFaults": true,
  "useAi": false
}
```

Use `variant: "clean"` for the fixed control. Defaults are Levels 1–2, AI disabled, 120 seconds, 300 requests, concurrency two, 10 requests/second and 32 MiB of persisted evidence. The opt-in field is required for Levels 3–5; setting it does **not** authorize high-risk execution on any external/user-provided server. Other optional fields are `recipeIds`, `scenarios`, `budget`, and `goals`; consult the schema for limits. Unknown fields are rejected. A run is queued asynchronously; the creation response is not a completed report.

For a user-owned application, use `target.kind: "loopback"`, an explicit numeric HTTP `baseUrl`, `approvedOrigins`, and `acknowledgeOwnership: true`. Supply explicit custom Level 1–2 scenarios; fixture recipes do not run against arbitrary apps. The supported vocabulary is navigate, fill, click, press, reload, back, forward, viewport, wait, and assert. There is no evaluate/shell/file/upload/fault action. Automatic mutation replay is unavailable for loopback targets.

PowerShell client example; the token stays in memory and is not printed:

```powershell
$session = Get-Content '.engine/session.json' -Raw | ConvertFrom-Json
$headers = @{ Authorization = "Bearer $($session.token)" }
$payload = @{ target = @{ kind = 'fixture'; variant = 'faulty' }; levels = @(1,2,3,4,5); allowFixtureFaults = $true; useAi = $false } | ConvertTo-Json -Depth 8
$run = Invoke-RestMethod "$($session.origin)/v1/runs" -Method Post -Headers $headers -ContentType 'application/json' -Body $payload
Invoke-RestMethod "$($session.origin)/v1/runs/$($run.id)" -Headers $headers
```

## Lifecycle and progress

```text
queued → preparing → running → analyzing → completed
                    ↘ failed / cancelled / timed_out / partially_completed
```

Queued runs can cancel without starting. Preparing includes starting the worker/browser/fixture. Running executes scenarios. Analyzing finalizes reports and optional AI. A completed run can contain confirmed defects. `partially_completed` indicates infrastructure, budget, or evidence limitations. Terminal states are final. The precise transition table is exported as `TRANSITIONS` in the domain module.

`run.progress` contains `totalScenarios`, `completedScenarios`, `currentScenarioId`, and `percent`. Percent is `floor(100 * completedScenarios / totalScenarios)`, not elapsed-time progress or an ETA. Reproduction attempts are part of the same scenario. Cancellation can remain `running`/`preparing` briefly while cleanup finishes; show “Stopping” after the 202 acknowledgement and wait for terminal state. A second cancellation is safe. Partial runs preserve finished results and list unexecuted scenario IDs in their report.

Poll `/v1/runs/{id}` every 500–1000 ms or use SSE. Browser `EventSource` cannot send this Bearer header; use `fetch` streaming. Events have global monotonic `id`, `runId`, `at`, `type`, and a small `data` object. Types: state, scenario, progress, evidence, warning. State/scenario messages contain status and identifiers, not screenshots, credentials or raw request bodies. On reconnect, send `Last-Event-ID` or `after`. History is replayed and the connection closes at terminal state. Heartbeat comments are sent every ten seconds; duplicates can be ignored by event ID. After a disconnect, retrieve the run snapshot and reconcile before reconnecting or requesting new work.

## Findings and artifacts

A result includes stable `id` and `runId`, versioned `scenarioId`, `title`, `level`, `category`, outcome, classification, origin, severity, **severityRationale**, `firstObservedAt`, expected/observed behavior, `reproductionSteps`, limitations and artifact IDs. `attempts` contain timestamped actions, assertion outcomes, timings and per-attempt evidence. `verification` explicitly records retest/reproduction and matching failed assertion IDs.

Keep classification distinct: confirmed, intermittent, suspected, inconclusive, passed. Also preserve `origin: application | infrastructure | policy`. A script timeout is not automatically an application defect. Suggested remediation contains a **hypothesis**, suggestion and required verification; `verified` is always false until a separate regression proves that fix. No fabricated confidence score is returned.

Evidence metadata includes ID, run/scenario/attempt, kind, MIME type, size, SHA-256, creation time and sensitivity flag. Build a safe URL using the IDs: `/v1/runs/{runId}/evidence/{artifactId}`. Do not construct filesystem URLs from `relativePath`. Fetch authenticated bytes into a Blob, then create and revoke an object URL for an image preview. Do not put the token in an `<img>` query string. Treat ZIP traces as downloads for a local trace viewer. The API rejects artifact path escape and unknown IDs.

Reports include all tested capabilities, explicit unexecuted/skipped/blocked/inconclusive counts, evidence references, replay instructions, environment and optional regression comparison. Comparisons must use compatible target contracts, recipes/scenarios, engine and budgets; clean/faulty variants of the included fixture are compatible.

## Environment and retention

Configuration names: `ENGINE_DATA_DIR`, `ENGINE_ARTIFACT_DIR`, `ENGINE_PORT`, `ENGINE_MAX_JOBS`, `ENGINE_TOKEN`, `ENGINE_ALLOWED_ORIGINS`, `FIXTURE_DATA_DIR`, `PLAYWRIGHT_BROWSERS_PATH`, `AI_ENABLED`, `AI_ENDPOINT`, `AI_MODEL`, `AI_API_KEY`. Safe examples are in `.env.example`; it contains no credentials and is **not automatically loaded**. Set process environment explicitly. No credential is needed for deterministic execution.

Evidence and history remain local and are retained until the owner removes them. Raw sensitive artifacts are never automatically sent to AI. There is no delete/TTL endpoint or total-history disk quota yet. The UI should show local storage location and artifact sensitivity rather than imply cloud synchronization.

## Tauri and mobile handoff

The desktop host should bundle a matching Node 24 runtime, compiled `dist/`, production dependencies and Chromium for each OS/architecture. Set a private OS application-data directory, `PLAYWRIGHT_BROWSERS_PATH`, an exact frontend origin and an ephemeral `ENGINE_PORT=0` if desired. Start the bundled runtime with `dist/cli/server.js`, wait for its session file, call health, then provide the token only to the local frontend. The engine forks the same bundled `process.execPath`, so end users do not need Node installed globally. On application exit request shutdown and await owned-process cleanup. Installer signing/notarization and macOS execution are separate unverified release work.

Mobile companions must never execute tests or receive the execution token. A future authenticated pairing relay can expose only `{ apiVersion, runId, state, completedScenarios, totalScenarios, findingCounts, updatedAt }` and explicitly selected sanitized reports. No pairing, relay, notifications, cloud identity or mobile app exists in this backend release.

**Next integration action:** start this backend, configure the frontend's exact loopback Origin, and connect its run screen to POST `/v1/runs`, authenticated fetch-SSE, cancellation, and authenticated artifact retrieval. Run the clean and faulty fixture examples through that actual UI and record separate frontend acceptance evidence.
