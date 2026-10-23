# Hardcase v1 integration contract

Canonical source: `src/domain/models.ts`, `src/api/contracts.ts`; complete generated request/response schemas: `docs/openapi.json`. Existing endpoint details and specimen payloads: [FRONTEND_HANDOFF.md](FRONTEND_HANDOFF.md). Backend origin is configurable via local session discovery, defaults to `http://127.0.0.1:4318`. Never bake an execution token into the frontend bundle.

All routes except GET `/v1/health` require `Authorization: Bearer <session.token>`. `ENGINE_ALLOWED_ORIGINS` allows exact local frontend origins only. Session is private at `<ENGINE_DATA_DIR>/session.json`; token rotates on restart unless explicitly configured. Tokens never belong in URLs or localStorage.

## Release additions

- POST `/v1/runs` and POST `/v1/runs/{id}/replay`: optional `Idempotency-Key` header, 8–128 ASCII letters/digits or `._:-`; UUID recommended. Retain one key across retries after uncertain failures. Same validated input and replay parent returns the original persisted Run with HTTP202, including after restart. Different input returns HTTP409 `{ "error": "IDEMPOTENCY_CONFLICT", "message": "..." }`. Original and retried responses include `Idempotency-Replayed: false|true`. Keys live as long as their history. Without a key, each call intentionally creates a separate run (legacy compatibility).
- GET `/v1/ready`: authenticated readiness, HTTP200 when ready,503 when unavailable; `{ok,version,checks:{storage,worker,chromium},issues:[{code,message}]}`. Chromium readiness includes an actual startup probe, not just a binary path. `/v1/health` remains unchanged liveness `{ok,version}`.
- GET `/v1/runs/{id}/events/poll?after=0&limit=100`: `{events,nextCursor,hasMore,terminal,state}`; limit1–200. Continue with nextCursor, poll500–1000ms when hasMore=false, stop when terminal and drained. Events use the same schema and IDs as SSE. Existing authenticated fetch-SSE remains supported.
- CORS explicitly allows `Idempotency-Key` and exposes `Idempotency-Replayed`.

## Observable flow

Prepare: GET capabilities/recipes; POST targets/validate; optional scenarios/validate. Start: POST runs with one stable idempotency key. Observe: GET run and fetch-SSE or event polling. Investigate: GET findings/evidence, then authenticated evidence-ID download to a Blob URL. Reproduce: POST replay with selected eligible fixture scenario IDs and a fresh operation key. Export: GET report?format=json or format=markdown. Cancellation: POST cancel, then observe terminal state after cleanup. History: GET runs?limit=50&offset=0. Exact bodies/errors and paths are in OpenAPI and FRONTEND_HANDOFF.

Controlled example: `{"target":{"kind":"fixture","variant":"faulty"},"levels":[3],"recipeIds":["hostile.authorization"],"allowFixtureFaults":true,"useAi":false}`. Use `clean` for the passing control. Defaults remain Levels1–2. Levels3–5 require explicit opt-in and engine-owned disposable fixtures. Public, DNS, LAN and cloud targets remain disabled; acknowledged loopback custom scenarios are local-only at Levels1–2.

Lifecycle: queued → preparing → running → analyzing → completed; failed/cancelled/timed_out/partially_completed are terminal alternatives. Completed describes execution and may contain defects. Progress counts completed scenarios, not time. Each result has stable finding/run/scenario IDs, timestamped attempts/actions, expected/observed assertions, classification, impact rationale, reproduction steps and artifact IDs. Artifact metadata includes capture time and SHA-256. Do not label uncaptured evidence or infrastructure failures as application defects.

HTTP errors:400 validation/scope,401 auth,403 Host/Origin,404 missing record/file,409 lifecycle/idempotency conflict,429 bounded queue/stream capacity,500 internal failure,503 unavailable dependencies. Error JSON is `{error,message}`. Never auto-retry non-idempotent run creation after a timeout.

Optional `errorCode` on a failed Run or Attempt supplies recovery context: `TARGET_UNREACHABLE`, `TARGET_TIMEOUT`, `BROWSER_UNAVAILABLE`, `SCOPE_BLOCKED`, `BUDGET_EXHAUSTED`, `EVIDENCE_CAPTURE_FAILED`, `WORKER_CRASH`, `WORKER_HEARTBEAT_LOST`, `RUN_TIMEOUT`, `CANCELLED`, `RESTART_INTERRUPTED`, or `EXECUTION_ERROR`. A partially completed run can have a null run-level error while an individual attempt explains the failure. Show the attempt diagnostic with its inconclusive result; do not convert it into a confirmed finding.

Recipe `hostile.authorization` is now version2: real browser interaction on `/permissions`, backed by HTTP status and state assertions, with screenshots/trace/actions/network/console evidence. Other built-in recipes and custom scenario definitions remain version1. Recipe versions are integers; a comparison between different versions reports `not_comparable` for that scenario. The permission fixture uses synthetic role headers and real server enforcement; it is not a production identity integration.

Session bootstrap for the integrated application belongs to the managed local launcher. `npm start` serves the built frontend and local API together; `npm run start:api` starts only this backend. See the root README for the canonical install/build/start workflow and packaged release status.
