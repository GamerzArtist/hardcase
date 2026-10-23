# Backend release audit — 23 October 2026

Canonical root: `D:/Code stuff/HACKATHON-PROJECTS/TEAM/hackathon-project-02`. It contains the existing backend history (`7c3d474`, `a8dc32b`, `6b28a2d`). At audit start the backend working tree was clean on `master`; the sibling frontend had an unborn `codex/frontend` branch and untracked source. Preserve that sibling. The frontend lead owns copying its source into `apps/web`, root scripts/lockfile/environment/README, frontend integration and desktop packaging. Backend ownership is `src/`, `tests/`, API specification and backend audit/verification documents. No destructive history migration is needed.

## Observed starting state

- Node 24 TypeScript service, Fastify 5, Zod 4, built-in SQLite, Playwright Chromium, Vitest. Exact versions are pinned in package-lock.json.
- API is bound to `127.0.0.1` only. Bearer token stays in local `session.json`. Exact Host and Origin checks; CORS denied by default. No cloud credentials required.
- Worker-per-run queue; persisted state and events; bounded network/worker lifecycle; real reports and UUID-addressed artifacts. Existing 49-test result is prior evidence and will be rerun for this release.
- Eight actual scenarios: browser workflows at Levels 1–2; local HTTP permission, synthetic cost/queue/dependency controls at Levels 3–5. These are controlled fixture observations, not arbitrary-site security coverage.
- External public/private-LAN targets are unsupported. Explicit numeric HTTP loopback and acknowledged ownership are the separate local trust context. Browser redirects are blocked before forwarding; server HTTP redirects are checked against approved origins. No DNS hostname target resolution is permitted.
- AI is disabled by default. Optional gateway has no verified live-provider integration. No provider spending, publication or submission is authorized.

## Release gaps resolved and verified

1. Added transactionally persisted Idempotency-Key for creation and replay, request-conflict rejection and retry-after-restart checks. Eight simultaneous starts produced one run.
2. Added authenticated dependency readiness with a real Chromium startup probe, worker-file and writable-storage checks; unavailable worker returns503 while liveness stays200.
3. Added bounded cursor polling and paginated SSE history, with backlog disconnect protection. JSON polling recovered1102events without loss/duplication.
4. Permission scenario version2 drives a clearly labeled fixture screen with real Chromium clicks, observable protected-state changes, screenshots and traces. The failure reproduced twice and in a separate replay; the clean control passed.
5. Verified offline target, evidence unavailable/capture failure, malformed targets, restart, cancel and all-tier execution. Source-linked actual run evidence is exported separately from sample JSON.

Final backend checks:55tests/10files passed, strict typecheck passed, audit0vulnerabilities. Fresh faulty run `754b4e25-30bc-4002-a243-8a917a863f55` produced7confirmed findings; clean run `ea14e39c-f9f9-4048-ae97-20e94ad923bd` passed8scenarios. Details, exact commands and reviewed screenshots: [BACKEND_E2E_VERIFICATION.md](BACKEND_E2E_VERIFICATION.md).

## Existing limits retained

No arbitrary external scanning, no high-risk runs against user-supplied targets, no real AI/billing/load simulation claims, no OS-level browser memory sandbox, no automatic history expiry/global disk quota. Screenshots/traces are local sensitive artifacts; text redaction is best effort. Native packaged acceptance belongs to the integration lead and is not established by backend unit tests.
