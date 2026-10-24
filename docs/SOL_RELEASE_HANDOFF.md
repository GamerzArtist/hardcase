# Frontend release handoff

Continue the existing canonical checkout and working source. The owner has authorized direct coordination with the frontend chat and substantial UI improvement. Do not restart the product, spawn subagents, alter backend security, or rebuild native packaging.

## Product and visual requirements

- Inspect the requested [Fluid Functionalism library](https://www.fluidfunctionalism.com/) and [sidebar preset](https://www.fluidfunctionalism.com/docs/sidebar?preset=sa1FQfCxG4). Verify the exact source, license, peer compatibility and provenance before copying or installing. Adapt to Hardcase tokens. Earlier supplied libraries remain options when they improve a concrete interaction; do not add effects indiscriminately.
- Use Impeccable as the design lead and `ui-library-integration` for component decisions. Respect the owner's no-subagent instruction and autonomous implementation request; do not create approval loops or arbitrary self-scores.
- Preserve chalk/sky/grass/graphite, overlapping-square identity, a cinematic light-first landing and a precise readable 2D workbench. Functional text needs practical contrast and size; no 8–11px primary controls. Normal, Chaos, Hostile, Siege and Breakpoint remain meaningful levels.
- Fix missing `testing-campus.webp` and `workspace-prepare.png`, `workspace-observe.png`, `workspace-investigate.png`. Use authentic assets and real screenshots with honest captions. Preserve the owner's supplied assets and ongoing Tripo work. A decorative graphic must not masquerade as live infrastructure or evidence.
- Remove radio/number overlap in level controls. Inspect desktop, narrow layouts, keyboard focus, reduced motion, loading/empty/error/recovery states and 200% zoom. Preserve draft and last known run state on network failures.

## Functional release requirements

Provide custom scenario JSON import/editing and server validation for explicitly owned loopback targets, sufficient to run `examples/reviewboard/scenarios/*.json`. Keep schema allowlists, ownership acknowledgement, levels 1–2 and replay restrictions intact. Main already built and independently verified Reviewboard; reuse its real scenarios and reports rather than recreating a target or weakening permissions.

Exercise through the UI: connect/reconnect, validate a custom scenario, start once, observe progress, cancellation, investigation, screenshot/action/network evidence, eligible fixture replay, export and reload/history recovery. Fix the known Connect/Reconnect test selector mismatch. Separate actual browser findings from injected/mocked UI states.

Update stale web docs claiming the backend lives in a separate repository or requiring manual native session files. Native startup now starts a private bundled engine and supplies the session through the existing Tauri `engine_session` command.

## Ownership and completion contract

You own `apps/web/**` except `apps/web/src-tauri/**`, root package/lock/README/.env/.gitignore work and `scripts/local-app.mjs`. Main owns backend, Reviewboard, `src-tauri`, `desktop*.mjs`, `package*.mjs`, `verify-runtime.mjs` and release documents. Coordinate shared root changes before touching them.

Run web typecheck/build and meaningful affected browser checks. Return source checkpoint, owned changed files, actual screenshots and run IDs, remaining limitations, and the explicit message **web dist ready for main packaging**. Main will independently inspect and package the result. Do not commit other owners' files or claim a model switch; the owner selects the frontend model manually.

