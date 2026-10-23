# Real standalone MVP verification

Executed on 2026-10-23 starting 13:24 IST with Chromium 156.0.8078.4. This extends the 55-test backend checkpoint at `6554457`; those tests were not unnecessarily repeated. The separate application is [Reviewboard](../examples/reviewboard/README.md), not a built-in Hardcase fixture or mocked API.

**Result:** Hardcase detected the deliberately seeded missing role check, reproduced the same three failed assertions in an independent run, and passed all workflows after the role check was enabled. The finding is genuine observed browser behavior in a controlled faulty application, not a claim of discovering an unknown production vulnerability.

| Run | Result |
| --- | --- |
| Faulty `b6ca6c33-2dbe-43e6-8cfb-38f7c3a2a057` | Viewer mutation failed 3 assertions; editor persistence and login recovery passed |
| Independent reproduction `48e24cff-6f8d-46dd-abd3-9c608547cabc` | Same 3 assertions failed with a fresh application database |
| Corrected `b347d0f5-af25-4abd-ab45-1a461392435e` | All 3 scenarios passed |

The viewer received HTTP 200 in faulty mode, observed **Task moved to Done**, and reloaded the task as **Done**. In clean mode the same action received HTTP 403, showed **Viewers cannot change task status**, and remained **Todo** after reload. Independent database reads matched the browser assertions. Editor creation and completion remained allowed and persisted after reload. Invalid credentials failed, corrected credentials worked, and logout revoked access.

Each loopback finding retains Hardcase's `suspected` classification and unassigned severity. The two independent runs provide reproduction evidence without misrepresenting the engine's automatic confirmation capability. The loopback replay endpoint still returns 409. No target, authorization or evidence restrictions were weakened.

## Evidence

- [Verification manifest](verification/reviewboard/verification.json): source hashes, browser version, readiness, exact assertions, database snapshots, artifact hashes and comparison.
- [Faulty report](verification/reviewboard/faulty/report.md) / [JSON](verification/reviewboard/faulty/report.json).
- [Independent reproduction report](verification/reviewboard/faulty-reproduction/report.md).
- [Corrected report](verification/reviewboard/clean/report.md).
- [Faulty viewer screenshot](verification/reviewboard/faulty/779d9478-e809-45c9-bea3-05798a2cde57.png) and [corrected viewer screenshot](verification/reviewboard/clean/3d3ebbdc-8a6f-4c69-889a-377551c3671e.png).
- [Editor desktop](verification/reviewboard/mvp-editor-desktop.png) and [viewer mobile](verification/reviewboard/mvp-viewer-mobile.png).

Screenshots were opened and visually inspected at desktop and 390px mobile widths. The manual browser pass recorded no page errors and no horizontal overflow. It verified invalid-login 401, viewer-change 403, viewer-create 403, and post-logout 401. Those are legitimate application denials, not engine authorization defects.

The run exported and hash-checked screenshots and sanitized actions/network/console logs. Raw Playwright traces remain private under `.engine/reviewboard/2026-10-23T07-54-46-548Z/engine/artifacts`; they are intentionally excluded from the committed packet because authenticated traces may contain cookies. The reports list those traces as captured evidence; their raw bytes are not in this public review directory.

## Scope and reproduction

Run the commands in [the MVP README](../examples/reviewboard/README.md). The evaluator drives the actual authenticated versioned Hardcase API and its isolated Chromium worker; it does not replace the product with an mjs assertion mock. The `.mjs` driver is only orchestration for launching the real applications and collecting artifacts.

This verifies owned loopback testing at Level 1, cookies, browser interaction, durable state, failure evidence, explicit reproduction and clean control. It does not prove public-target support, arbitrary redirects, cloud auth, AI provider behavior or native desktop packaging. Unified Hardcase UI acceptance and packaging are tracked separately by the release work.
