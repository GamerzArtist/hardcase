# Backend release verification — 23 October 2026

Backend status: **READY FOR OWNER REVIEW**. This is backend execution/evidence acceptance; the integrated application and packaged desktop have their own checks in the frontend lead's `SUBMISSION_REVIEW.md`. Canonical repository: `D:/Code stuff/HACKATHON-PROJECTS/TEAM/hackathon-project-02`, shared branch `codex/hardcase-release`.

## Executed checks

| Check | Observed result |
|---|---|
| `npm run test:api` | 55 passed,10 test files,79.86seconds |
| `npm run typecheck:api` | Passed strict application and test TypeScript checks |
| `node dist/cli/spec.js` | Generated actual OpenAPI and explicitly labeled sample JSON |
| `npm audit --json` | Zero vulnerabilities in the current integrated lockfile |
| Fresh `node dist/cli/demo.js` | Passed actual all-tier faulty/clean execution, idempotent Start, SSE, permission-artifact hash/download checks, replay, active cancellation and restart |
| Screenshot inspection | Actual faulty and clean `/permissions` renders inspected; viewer200 versus403, with synthetic fixture label and explicit policy visible |

The six new release tests cover eight concurrent Start requests yielding one run, conflict/malformed-key rejection, normalized-body retries, persistence across restart, malformed/public/private/metadata URL refusal, cursor pagination beyond1000events, dependency readiness failure, actual browser authorization/replay, authenticated SHA-256-matching downloads, missing-evidence404, unreachable target classification, and evidence capture failure. The existing suite additionally covers clean empty-finding control, all tiers, external redirects, input/schema/scope limits, cancellation in browser/load/report finalization, worker crash/liveness/deadline cleanup, abrupt API termination and restart.

Lifecycle harness tests use explicitly controlled child workers to exercise crash/hang conditions. These are infrastructure tests. The fixture/browser E2E and saved demo below run the actual Chromium runner and actual local HTTP application; no hardcoded finding response is used.

## Saved run evidence

Full local proof: `.engine/release-20261023/verification.json`. A portable reviewed export is [verification.json](verification/backend-release/verification.json). Captured demo output is [demo-output.txt](verification/backend-release/demo-output.txt). Session credentials, local database and raw traces remain gitignored.

| Run | ID | Actual result |
|---|---|---|
| Faulty fixture | `754b4e25-30bc-4002-a243-8a917a863f55` | Completed;7confirmed findings,1pass; all5tiers executed |
| Clean control | `ea14e39c-f9f9-4048-ae97-20e94ad923bd` | Completed;8passes,0confirmed findings |
| Permission replay | `afa1387b-637f-4ce2-9267-672309b2ad8b` | Completed; reproduced the permission failure |
| Mid-run stop | `7f50c066-397d-43d1-9a08-d80375172696` | Cancelled;0active workers afterward |

Restart preserved the completed run, artifact references and saved report. Both fixture Start retries returned their original ID. `/v1/ready` returned all checks true: storage, compiled worker and actual Chromium startup.

## Demonstrated permission failure

Finding `5df02bbb-4827-42ff-9e48-1b63548d7f14`, scenario `hostile.authorization`, version2, in the faulty run above. Two independent reset-state attempts failed the same assertions: viewer must receive403 but received200; viewer must leave protected state unchanged but incremented the counter from0to1. The permitted admin control then succeeded. The final screenshot's counter is2 because it includes both the unauthorized viewer action and the allowed admin action.

Source: `src/fixtures/app.ts`, `FIXTURE_POLICY.permission` and `POST /api/admin/reset`; driver: `src/strategies/execute.ts`, `hostile.authorization`. The saved manifest records SHA-256 hashes of these source files, the recipe, API and persistence implementation. Action JSON records source references, click selectors, capture/action timestamps and actual expected/observed assertions. This demonstrates a controlled fixture permission defect; role headers are synthetic identities, not production authentication.

- [Faulty screenshot](verification/backend-release/754b4e25-30bc-4002-a243-8a917a863f55/ed96240f-9a72-4e57-ac6f-f0942658b017.png), captured `2026-10-23T02:46:20.580Z` (08:16:20.580IST), SHA-256 `20f4e2963805b7349738bd238020546ce9e619f4daf292184e6128e3b4e174e0`.
- [Clean screenshot](verification/backend-release/ea14e39c-f9f9-4048-ae97-20e94ad923bd/938ab812-4532-4137-8335-6a6d15ffaae4.png), captured `2026-10-23T02:46:38.651Z` (08:16:38.651IST), SHA-256 `790ce1e0cd100ba1dffb5567889ad6e8b45d8c0eb858c00e6c9473071519dad7`.
- [Faulty JSON export](verification/backend-release/754b4e25-30bc-4002-a243-8a917a863f55/report.json) and [readable Markdown export](verification/backend-release/754b4e25-30bc-4002-a243-8a917a863f55/report.md).
- [Clean Markdown export](verification/backend-release/ea14e39c-f9f9-4048-ae97-20e94ad923bd/report.md).

## Reproduce

From the canonical root, install with `npm ci`, install the matching browser with `npx playwright install chromium`, then `npm run build`. `npm start` launches the integrated local application; use its managed local session. Default web origin is `http://127.0.0.1:4327`; the backend session supplies its actual ephemeral API origin. To run only the API, use `npm run start:api` (default API port4318) and set exact `ENGINE_ALLOWED_ORIGINS` if using a separate UI.

For a fresh inspectable backend proof:

```powershell
$env:ENGINE_DATA_DIR = '.engine/review-reproduction'
npm run demo
```

This invokes actual Chromium and local HTTP, saves a new verification file, downloads/hashes the permission evidence, replays the permission scenario, cancels an active run and verifies restart. It makes no AI/provider call and scans no external target. To run just the permission case through the API, send this body to POST `/v1/runs` with the local bearer header and a fresh UUID `Idempotency-Key`:

```json
{"target":{"kind":"fixture","variant":"faulty"},"levels":[3],"recipeIds":["hostile.authorization"],"allowFixtureFaults":true,"useAi":false}
```

Follow `GET /v1/runs/{id}` or authenticated SSE/JSON polling to terminal. Select `hostile.authorization`, fetch evidence by its stable artifact ID, and export JSON or Markdown. POST `/v1/runs/{id}/replay` with `{"scenarioIds":["hostile.authorization"]}` and a new operation key to reproduce. For manual button-by-button reproduction, see [FIXTURES.md](FIXTURES.md).

## Verified, partial and unsupported

| Capability | Release evidence/status |
|---|---|
| API/auth/CORS, persisted lifecycle, deduplicated Start/replay, event feed/polling, cancellation | Verified locally |
| Real browser permission defect, independent reproduction, clean control, artifact integrity/export | Verified locally; synthetic fixture identity/data |
| Levels1–2 | Real browser workflows; explicit custom owned-loopback scenarios supported |
| Levels3–5 | Implemented on disposable fixtures only; synthetic cost/queue/dependency policies and bounded actual HTTP |
| Public/DNS/LAN/cloud testing | Disabled; no external authorization/SSRF security claim |
| AI provider/billing | Disabled for verification; live integration unverified |
| Evidence privacy | Text metadata redacted; reviewed synthetic evidence exported; raw traces/screenshots generally require private handling |
| Retention | Per-run quotas and disposable cleanup verified; global history quota/automatic expiry absent |
| Browser CPU/RSS hard isolation | Not implemented; worker V8 heap and execution/network caps are enforced |
| Native packaging/UI acceptance | Separately owned and reported by integration lead; backend success does not prove native acceptance |

No external credential is needed for the verified backend. No publication, hosting, submission or paid request was performed. Complete application readiness must use the integrated UI evidence and packaging limitations, not this backend table alone.
