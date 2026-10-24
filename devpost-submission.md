# Hardcase — Devpost copy

Prepared for **Neighborhood Hacks 2026**. Draft only; nothing has been submitted or changed on Devpost by this work. Official requirements and dates were checked through the connected Devpost service on 23 October 2026. Deadline: **24 October, 10:30 AM IST**.

## Project name

Hardcase

## Elevator pitch

Find the failures your happy-path demo misses. Hardcase runs controlled browser tests against apps you own and turns failures into evidence, reproduction steps, and shareable reports.

## What is the specific problem, and how do you know it's real?

Small teams and solo developers can build a convincing demo before they have checked whether permissions, saved state, and error recovery actually work. For community projects, a broken permission check or a lost update can undermine trust even when the main screen looks correct.

We investigated this with a separate task-management MVP, Reviewboard, with real login sessions, editor/viewer roles and a SQLite database. In its deliberately faulty version, a viewer could change a task that should have been read-only. Hardcase drove the browser, recorded the successful unauthorized change, and showed that it remained after reload. A fresh independent run reproduced the same three failed assertions. When we enabled the missing server-side role check, the same workflow received a 403 response and preserved the original task, while legitimate editor actions still worked.

This is controlled experimental evidence of the failure mode, not a claim of discovering an unknown vulnerability in someone else's service. We have not conducted user interviews or measured community adoption yet.

## Inspiration

Building software has become faster. Checking that it behaves correctly under pressure still takes care. We wanted to give independent builders a clear path from “it worked in my demo” to “here is what we tested, what failed, and how to reproduce it.”

## What it does

Hardcase is a local application testing workbench. Prepare a bounded test, watch real execution, investigate findings, inspect screenshots and recorded actions, reproduce eligible failures, and export JSON or Markdown reports.

Its five levels—Normal, Chaos, Hostile, Siege and Breakpoint—make the test scope explicit. Disposable demonstration fixtures support all five levels. Applications owned by the user on localhost support bounded custom browser scenarios at levels 1–2. Public and private-network scanning are disabled in V1.

The interface separates assertion-backed findings from inconclusive results and infrastructure failures. A failed engine connection is not reported as an application vulnerability. Tests preserve legitimate authorization restrictions, and authenticated evidence remains local.

## How we built it

The frontend uses React, TypeScript and Vite. A Node.js/Fastify API validates requests and enforces target scope, a SQLite store preserves history, and isolated Playwright workers drive actual Chromium browsers. Zod schemas constrain scenario input. The Windows wrapper uses Tauri and a private bundled local engine. Motion, Lucide and local fonts support the interface; component provenance is documented in the repository.

Codex helped implement, integrate, debug and verify the product across the frontend, backend and packaging. Runtime testing does not require an AI API key. The release evidence was collected with AI-provider calls disabled; we do not claim a verified live AI integration.

## Challenges we ran into

We had to make the UI and engine agree about authorization, run lifecycle, cancellation and evidence access. We added durable duplicate-start protection so retries do not silently launch another test. We also distinguished expected 403 denials from actual permission defects and kept unsupported target types blocked. Native testing exposed a Windows extended-path issue that compilation alone did not catch.

## Accomplishments

- A unified local workflow from preparation to recorded evidence and export.
- A backend checkpoint with 55 passing tests, plus real all-tier fixture runs, replay, cancellation and restart verification.
- Real testing against a separately built authenticated MVP: a faulty case, independent reproduction, and a corrected control.
- Hash-checked artifacts and reports with honest classifications and documented scope.

Use `docs/WINDOWS_RELEASE.md` for the final packaging and UI verification status; do not claim an unverified platform or deployment.

## What we learned

A screenshot is not proof that a workflow works, and a failed request is not automatically a security finding. Useful testing needs an explicit expectation, an observed result, saved evidence and a reproducible path. Controlled faulty and corrected applications made those distinctions testable.

## What's next

Improve custom-scenario authoring, expand accessible workflow coverage, add clearer evidence retention controls, and evaluate support for additional authorized environments with appropriate isolation. Gather feedback from independent builders before expanding the target scope.

## Built with

TypeScript, React, Vite, Node.js, Fastify, Playwright, Chromium, SQLite, Zod, Rust, Tauri, Motion, Lucide, Codex.

## Required form fields and assets

The [official event](https://neighborhood-hacks-2026.devpost.com/) requires a name, short pitch, full description, a **2–6 minute working demo video**, and a **public source repository link**. Its custom fields are:

| Field | What to enter |
| --- | --- |
| What is the specific problem, and how do you know it's real? | Paste the dedicated answer above. |
| Whats your teams email? | Enter the owner's preferred team contact email. |
| Public repository | Add the public repository URL. This checkout currently has no configured Git remote. |
| Demo video | Add the uploaded video URL. No video URL has been supplied. |
| Website, if used | Add an actually deployed URL only. The local `127.0.0.1` address is not a public demo. |

A website and ZIP upload are not mandatory in the fetched deliverable settings. Confirm eligibility and the final form in Devpost before submitting. The current account is registered; that alone does not confirm this project has been submitted.

## Three-minute demo outline

1. **0:00–0:20:** Show Hardcase and explain the problem: working demos can hide broken permissions or lost state.
2. **0:20–0:50:** Show Prepare, the bounded local target and the five levels. Start the faulty fixture.
3. **0:50–1:25:** Show real progress, then a finding with expected versus observed behavior and a screenshot.
4. **1:25–2:15:** Show Reviewboard's viewer workflow and the saved faulty/corrected evidence. Explain that the fault was intentionally seeded and the independent reproduction is real.
5. **2:15–2:45:** Replay an eligible fixture finding and export its report. Show saved history.
6. **2:45–3:00:** State the V1 boundary: local, owned applications; controlled fixtures for higher tiers; no API key required for the demonstrated flow.

## Screenshots to use

Use the final rendered Prepare, Observe and Investigate captures from the release evidence, plus the real Reviewboard faulty/corrected screenshots linked in `docs/REVIEWBOARD_VERIFICATION.md`. Do not upload private session files or raw authenticated browser traces. Do not use a concept illustration as a screenshot of working functionality.
