# Hardcase — verified evaluator packet

> Status: documented October 24, 2026 release evidence. This document is a transparent evaluation aid, not a certificate of security or a claim of live capabilities beyond those recorded.

## One-sentence product explanation

Hardcase is a local-first adversarial application-testing workbench that executes bounded Playwright/Chromium workflows and produces inspectable evidence—findings, screenshots, reproduction steps, replay where supported, reports, and durable run history.

## Who it serves

Solo developers and small teams who want to verify their own applications beyond the happy path: roles and permissions, persistence, browser workflows and fault handling. Independent adoption and demand have **not** been established through user interviews or measured usage.

## Demonstrable, shipped functionality

- A single-origin local web workspace with a private Fastify engine.
- Actual Chromium execution using isolated Playwright workers, with constrained scenarios and evidence.
- Five explicit test scopes (Normal, Chaos, Hostile, Siege, Breakpoint) on disposable fixtures.
- User-owned loopback applications support bounded custom browser scenarios at **levels 1–2 only**. Higher levels are fixture-only.
- Screenshot inspection, reproduction instructions, report export (JSON/Markdown), persistent run history; fixture finding replay where supported.
- Windows x64 installer built with Tauri and bundled local engine.

### Verified results (October 2026 release)

The [release verification record](HARDCASE_FINAL_RELEASE.md) reports 55 passing backend tests, 24 frontend unit tests and eight browser workflow tests. The clean all-tier fixture passed eight scenarios; an intentionally faulty fixture produced seven confirmed findings from eight scenarios. Actual WebView2 acceptance covered the five test levels and the evidence lifecycle.

The separate [Reviewboard controlled MVP experiment](REVIEWBOARD_VERIFICATION.md) exercised real sessions and editor/viewer roles. In the deliberately faulty application, a viewer changed a protected task, and the unauthorized mutation survived reload; a fresh database reproduced three failed assertions. With server-side authorization corrected, viewer changes returned HTTP 403 and editor workflows continued to work. This is **controlled validation**, not evidence of an unknown third-party vulnerability.

## Inspect the implementation

- [Source](https://github.com/GamerzArtist/hardcase)
- [Public read-only example workspace](https://hardcase.vercel.app)
- [Windows x64 distribution](https://hardcase.vercel.app/downloads)
- [Verified release documentation](HARDCASE_FINAL_RELEASE.md)
- [Standalone MVP experiment](REVIEWBOARD_VERIFICATION.md)
- [Source setup and tests](../README.md)

### Reproduce locally

Requires the documented compatible Node 24 version, npm and a Chromium download:

```powershell
npm ci
npx playwright install chromium
npm run dev
```

Open the local URL printed by the launcher. For controlled demonstration, choose the deliberately faulty **Notes** fixture, select **Breakpoint**, explicitly enable disposable-fixture faults, start a run, inspect the persistence finding and screenshot, follow reproduction steps, then export a report and revisit history. The project README contains the latest authoritative commands; check dependencies and safety scope before running.

## Demo links and provenance

- [Current published working demo — 2:01](https://youtu.be/tS3_Sfe0Xyw)
- [Earlier working demo — 2:20](https://youtu.be/Ao5c50UgmzU)
- Initial development and verification occurred **October 22–24, 2026**.
- Previously entered in [Neighborhood Hacks](https://devpost.com/software/hardcase) on October 24, 2026.
- Any future event entry must disclose the previous project and distinguish genuinely new work carried out during that event. A new description or re-edited video alone is not evidence of new implementation.

## Explicit limitations and safety boundaries

1. The Vercel website is an **interactive read-only presentation of real recorded fixture evidence**, not a hosted live scanner.
2. Browser execution happens locally, on disposable test fixtures or authorized loopback applications; unsupported public/LAN targets remain blocked.
3. No deployed live AI-provider integration, autonomous AI scenario generation, remote mobile control, cloud history synchronization, macOS/Linux installer, or signed Windows distribution is claimed.
4. Runtime evidence was gathered with AI-provider calls disabled. Codex assisted the development and verification; illustrated landscape assets were AI-assisted.
5. Results do not demonstrate general security coverage, universal correctness, or production suitability for arbitrary targets.
6. Screenshots and reports involving authentication must remain access-controlled. Private traces and credentials are intentionally not part of the public packet.

## What makes a credible evaluator demo

Show the real application performing one bounded task end to end, with the **expected behavior**, **actual behavior**, an inspectable artifact and the final exported report. Briefly demonstrate a corrected-control outcome. State the unsupported scope verbally or as on-screen text. Never substitute motion graphics for the working-product demonstration.

This packet intentionally avoids unsupported statements about user count, vulnerabilities in third-party services, AI runtime features or later development milestones. The links and test results describe the October 2026 release; re-run verification before representing any later commits as equally tested.
