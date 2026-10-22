# Backend implementation and verification report

Date: **22 October 2026 (Asia/Kolkata)**. Repository: `D:\Code stuff\HACKATHON-PROJECTS\TEAM\hackathon-project-02`.

The local backend vertical slice is implemented and executed. All five tiers have executable strategies. The latest full suite passed **49 tests in 8 files**. The independent API demo completed the faulty and clean five-level runs, generated evidence/reports, streamed progress, reproduced a defect, compared results, cancelled a run, and reloaded completed history after restart with AI disabled.

This is a verified local Windows backend, not a claim of production readiness, frontend acceptance, public-target scanning, or real billing/provider testing.

## Implemented scope

- Strict TypeScript, Fastify 5, Zod 4, Playwright, Vitest and Node SQLite; exact versions in the lockfile.
- Versioned authenticated API, target/scenario validation, recipe discovery, run creation/list/inspection, live SSE, cancellation, findings/evidence retrieval, JSON/Markdown exports, eligible replay and compatible-run comparison.
- Isolated workers, FIFO scheduling, heartbeats, hard deadlines, cooperative/forced cancellation, worker crash cleanup and startup recovery.
- Canonical loopback-only targets, explicit origins, redirect safeguards, network count/rate/concurrency/body limits and fixture-only fault permissions.
- Deterministic clean/faulty fixtures; real Chromium workflows, real local HTTP observations and explicit assertion outcomes.
- Stable finding/artifact IDs, hashes, severity rationales, observed/expected values, timestamped steps, reproduction status, screenshots/traces, redacted metadata and persisted history.
- Optional gateway adapter with strict proposals, bounded requests and failure behavior; the deterministic path makes no AI call.
- Frontend contracts, a complete handoff, scenario samples marked `sample`, and mobile status/desktop sidecar design notes.

## Completion matrix

| Engine | Implemented and executed | Simulated using fixtures | Implemented but unverified / not implemented |
|---|---|---|---|
| Normal | Two Chromium scenarios; valid save/reload/navigation/focus/narrow layout, draft persistence | Synthetic notes/drafts only | Broad accessibility certification and arbitrary workflow discovery are not implemented |
| Chaos | Two browser/HTTP scenarios; duplicate submissions, tabs, invalid inputs, delay/interruption/retry checks | Fixture delay and known operation IDs | Automatic arbitrary-app mutation/reproduction is deliberately unavailable |
| Hostile | Two real local HTTP scenarios with explicit policies | Viewer/admin roles, token units, billing/quota counters; no provider/bank | Real production identity/billing integrations are not implemented |
| Siege | Real low-concurrency HTTP burst, queue/throttle/duplicate/recovery assertions, actual latency samples | Logical event-volume payload; fixture queue policy | Public/staging load testing is not implemented or authorized |
| Breakpoint | Real requests measuring outage/timeout/write-failure and recovery integrity | Dependency failures and integer-balance writes in a disposable SQLite app | Fault injection into user-owned or external applications is not implemented |

The fifth tier is **Breakpoint**, from the original specification and the implemented source. No tier is a cosmetic label. Levels 3–5 require `allowFixtureFaults: true`; the default run selects Levels 1–2.

## Actual verification

Runtime: Node **v24.11.1**, npm **11.6.2**, Windows; Chromium **156.0.8078.4**, installed by Playwright **1.64.1**. Tests use temporary isolated data. Native SQLite's experimental-feature warning is expected on this Node version and was not hidden.

| Command / check | Actual final outcome |
|---|---|
| `npm install --no-fund` | Dependencies installed. Initial audit found 2 advisories in the initially selected test stack; resolved by pinning Vitest 4.1.12 |
| `npx playwright install chromium` | Exit 0; Chromium/headless shell and FFmpeg installed |
| `npm run build` | Exit 0; strict TypeScript compiled |
| `npm run typecheck` | Exit 0 for source and test TypeScript |
| `npm run test:unit` | Exit 0; **34 passed**, 4 files |
| `npx vitest run tests/e2e/termination.test.ts` | Exit 0; **1 passed**, including abrupt API death and restart reconciliation |
| `npm run test:integration` — final targeted run | Exit 0; **6 passed**, including cancellation during report I/O |
| `npm test` — final run | Exit 0; **49 passed**, **8 files passed**, **61.25 seconds** |
| Full-suite breakdown | 34 unit + 6 API/process integration + 9 real-browser/process E2E |
| `npm run api:spec` | Exit 0; OpenAPI and schema-validated labeled samples generated |
| `npm audit --omit=dev` and final `npm audit` | Exit 0; **0 vulnerabilities**, including the development dependency audit |
| `npm run demo` with `ENGINE_DATA_DIR=.engine/verified` | Exit 0; `verification.json` has `passed: true` |
| `git diff --cached --check` | Exit 0 before implementation commit |
| Rendered inspection | Viewed actual 360×740 normal-workflow screenshot and 1280×800 duplicate-submission screenshot; narrow content fits, focus outline visible, duplicate rows visibly match assertions |

Final test runner output:

```text
Test Files  8 passed (8)
     Tests  49 passed (49)
  Start at  18:27:04
  Duration  61.25s (transform 259ms, setup 0ms, import 1.70s, tests 58.27s, environment 1ms)
```

Intermediate failures were investigated rather than counted as passes: the initial integration test incorrectly counted OpenAPI paths (GET/POST share a path); early E2E tests tried the uncompiled source-worker path; the hard-kill test exposed leftover disposable files and led to startup reconciliation; one scenario-budget test incorrectly expected a blocked network request even when execution stopped before issuing it. Final review also found and fixed a cancellation race during asynchronous report writes; the added integration regression passed, followed by the complete 49-test suite. Earlier failing outputs do not supersede the final executed results above.

## Independent demo evidence

Actual run IDs, not samples:

| Run | ID | Outcome |
|---|---|---|
| Faulty five-level fixture | `8920abf6-24c4-40c1-9c8e-d85921645c70` | completed; 1 pass, 7 confirmed failures; 51 artifacts; 138 actual requests; 162 simulated event units; 89 progress/events |
| Clean five-level fixture | `84ffd651-0d9e-4f1c-934e-dc6ac8a131d4` | completed; 8 passes; 28 artifacts; 77 actual requests; 81 simulated event units; 59 progress/events |
| Persistence replay | `b675bfb8-bd49-410a-a64a-d95860124d7c` | completed; meaningful persistence defect reproduced |
| Cancellation | `c9a051e0-4bbe-4876-9d46-05dcdaf7292a` | cancelled; zero remaining active workers |

The seven confirmed findings are lost acknowledged draft writes; duplicate browser submissions; duplicate interrupted-operation retries; viewer permission bypass; synthetic cost-ceiling/idempotency failure; unbounded fixture queue/missing event deduplication/throttling; and partial balance mutation after outage/timeout/write failure. Each reproduced a matching failed assertion on the second fresh-state attempt. The corresponding clean scenarios passed. Comparison reports seven `resolved_in_this_run` changes and one unchanged pass.

Artifacts remain locally at:

```text
.engine/verified/verification.json
.engine/verified/history.sqlite
.engine/verified/faulty-events.sse
.engine/verified/clean-events.sse
.engine/verified/artifacts/8920abf6-24c4-40c1-9c8e-d85921645c70/report.json
.engine/verified/artifacts/8920abf6-24c4-40c1-9c8e-d85921645c70/report.md
.engine/verified/artifacts/84ffd651-0d9e-4f1c-934e-dc6ac8a131d4/report.json
.engine/verified/artifacts/84ffd651-0d9e-4f1c-934e-dc6ac8a131d4/report.md
```

PNG/ZIP/metadata files sit beside their run reports; the reports map stable artifact IDs to filenames and SHA-256 values. Raw evidence and local credentials are gitignored. A sanitized verification manifest is committed at `docs/verification/session-verification.json`.

These saved demo artifacts were captured at implementation commit `7c3d474`, before the final report-cancellation race fix. Scenario assertions were unchanged by that fix; the full five-level E2E test ran again as part of the final 49-test suite at `a8dc32b`.

## Reproduce

```powershell
npm ci
npx playwright install chromium
npm run build
npm start
```

Default API: `http://127.0.0.1:4318`. Optional standalone fixture: `npm run fixture` (faulty) or `npm run fixture -- --clean`, at `http://127.0.0.1:4319`. Engine runs create their own fixtures.

To repeat the complete API demonstration without starting a separate server:

```powershell
$env:ENGINE_DATA_DIR = '.engine/repeat-demo'
npm run demo
```

To create individual clean or broken runs through the running API, use the PowerShell example in `docs/FRONTEND_HANDOFF.md`, choose `variant: clean` or `faulty`, set `levels: [1,2,3,4,5]`, `allowFixtureFaults: true`, and `useAi: false`. Retrieve the run, report and evidence through the documented authenticated routes. `npm test` runs all checks; the separate test scripts select unit, integration or E2E scopes.

Configuration variable names: `ENGINE_DATA_DIR`, `ENGINE_ARTIFACT_DIR`, `ENGINE_PORT`, `ENGINE_MAX_JOBS`, `ENGINE_TOKEN`, `ENGINE_ALLOWED_ORIGINS`, `FIXTURE_DATA_DIR`, `PLAYWRIGHT_BROWSERS_PATH`, `AI_ENABLED`, `AI_ENDPOINT`, `AI_MODEL`, `AI_API_KEY`. No credentials are needed for local deterministic runs. `.env.example` contains only safe examples and is not loaded automatically.

## Limitations and remaining work

No known failing P0 was observed in the verified local fixture/API scope. The following work remains explicit:

1. **Separate frontend acceptance is pending.** No sibling frontend files were touched. The API is tested with real fetch clients, but its integration with the separate UI has not been executed.
2. **Native distribution is pending.** The engine uses `process.execPath` so a sidecar can bundle Node and Chromium. Windows installer/signing, macOS packaging/runtime checks and end-user bundles were not produced. No Tauri/mobile UI, pairing, Clerk, cloud account or push service was added.
3. **Live AI is unverified and optional.** A vendor-neutral gateway adapter and deterministic failure tests exist. Provider interoperability, tokenizer enforcement and actual monetary caps require a separately configured gateway; no live credit-consuming call occurred.
4. **Target scope is intentionally narrow.** Only owned loopback HTTP and included fixtures are supported. HTTPS/custom-domain staging, LAN/public targets, public PHP vulnerability scanning and high-risk execution outside owned fixtures are unavailable.
5. **Privacy and storage limits remain.** Raw traces/screenshots can contain sensitive page data. Redaction is best-effort; historical storage has no TTL/global quota, and transient trace size is checked at finalization. Chromium RSS/CPU is not an OS-enforced memory quota. See `docs/SECURITY.md` for exact caps and boundaries.
6. **Hard-kill recovery differs from graceful shutdown.** Tests verify listeners stop after abrupt API death and restart cleans disposable disk leftovers/marks interrupted runs failed. Power loss or killing all owned processes cannot execute immediate finalizers.
7. **Coverage is bounded.** Basic Tab/narrow-layout checks are not comprehensive accessibility certification; passing the suite does not establish application security or freedom from defects.

There are no pending external credentials or permissions for the local demo. No deployment, publication, remote push, credit spend or Devpost submission was performed.

## Changed files, Git and next integration action

Verified implementation commits: **`7c3d47483b742a53db66acb90fc55e52db9917e6`** (backend and fixture suite) and **`a8dc32b3ddbad2e5919471c18d20a75a2114c777`** (report-finalization cancellation fix and regression). Documentation, generated OpenAPI, labeled samples and this verification report are a separate handoff commit. The repository was empty and had no Git repository/remotes at the initial inspection; Git was initialized locally. No pre-existing tracked changes were overwritten. No remote is configured.

Changed source areas are listed in the README repository map. `git show --stat 7c3d474` lists the initial implementation files; `git log -3 --oneline` identifies both implementation commits and the handoff commit. Runtime artifacts, dependencies and compiled output are ignored. **Final handoff Git status: clean working tree**, checked after the documentation commit. No lint/formatter configuration existed, so strict typechecking, executed tests and whitespace checking are the available quality gates.

**Single best next action:** connect the separate frontend to the real API using `docs/FRONTEND_HANDOFF.md`, then run clean and faulty fixture flows through its run screen with authenticated SSE, cancellation and evidence previews. Record that UI acceptance separately from the backend proof in this report.
