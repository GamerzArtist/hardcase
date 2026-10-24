# Hardcase release coordination

Canonical repository: `D:\Code stuff\HACKATHON-PROJECTS\TEAM\hackathon-project-02`.
Branch: `codex/hardcase-release`. Deadline: 24 October 2026, 10:30 AM IST. Internal target: owner review on 23 October.

## Current authority and ownership

The owner's latest direction controls: finish the integrated product, improve the actual interface substantially, use Fluid Functionalism's sidebar preset `sa1FQfCxG4` alongside suitable previously supplied libraries, preserve legitimate target restrictions, and demonstrate real browser findings against the standalone controlled MVP. The original light-first Hardcase identity remains. Generated concepts are references, not evidence or approved final screens. The owner is handling the Tripo model.

Main owns backend, `examples/reviewboard`, native `apps/web/src-tauri`, desktop/runtime packaging scripts, release coordination and independent verification. The existing **Build adversarial testing frontend** chat owns web source, web tests/assets, root package files/README and `scripts/local-app.mjs`. No subagents. Preserve concurrent changes and commit only owned files. No Devpost submission.

## Verified checkpoint — retain, do not repeat without a reason

| Checkpoint | Evidence |
| --- | --- |
| Backend API and safety | Commit `6554457`; 55 tests in 10 files passed, API typecheck passed, real five-tier faulty/clean runs, replay, cancellation, duplicate-start protection and durable history verified. See `BACKEND_E2E_VERIFICATION.md`. |
| Independent controlled MVP | Commit `f4e4f4c`; standalone Reviewboard login, roles, tasks and SQLite persistence tested by Hardcase in real Chromium. Faulty viewer mutation reproduced in a fresh run; clean permission enforcement passed. See `REVIEWBOARD_VERIFICATION.md`. Findings remain truthfully **suspected** under the owned-loopback policy. |
| Bundled runtime | `.engine/package-smoke/2026-10-23T08-06-07-122Z/verification.json`: bundled Node and Chromium completed a real fixture run with a restricted PATH, captured five artifacts and shut down cleanly. This checkpoint excluded web assets. |
| Native compilation | `cargo check --locked --manifest-path apps/web/src-tauri/Cargo.toml` passed. An installer and native-window flow still require verification. |

## Active work and release gates

1. Frontend: fulfill `SOL_RELEASE_HANDOFF.md`, fix missing landing assets and small controls, integrate the requested sidebar, complete custom scenario input and actual browser QA. Report a current web build before packaging.
2. Main: finish portable web/native packaging, inspect the integrated UI independently, verify production startup, actual browser execution, evidence/reproduction/export and shutdown in the packaged app.
3. Support, only if the owner supplies a separate chat: `LUNA_RELEASE_HANDOFF.md` defines a bounded read-only release audit. Main remains accountable if no support chat is used.

Do not label a stale frontend build, a screenshot, a mocked response or compilation as complete end-to-end proof. Record exact run IDs, source checkpoint and remaining limitations. Local operation supports fixtures at levels 1–5 and explicitly owned loopback applications at levels 1–2; it does not authorize public scanning.

## Latest observed defects

Main's actual browser audit found missing `testing-campus.webp` and three `workspace-*.png` assets, leaving blank landing sections. Prepare labels were undersized and native radio controls overlapped level numbers. The dev engine started under a prior restricted permission profile reported Chromium `EPERM`; it was restarted with the restored full-access profile. Readiness must be checked on the current process before calling this a product defect.

Source screenshots: `.codex/visualizations/2026/10/22/01a16293-aa7b-7473-973b-e4a9e8bd2ed5/fidelity-audit` in the owner's home directory. These are pre-redesign audit evidence, not release screenshots.

