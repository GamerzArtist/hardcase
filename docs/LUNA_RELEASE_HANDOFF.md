# Optional independent release audit handoff

Use only in a separate owner-selected support chat. Do not spawn subagents or change product architecture. Work in the canonical Hardcase checkout. Preserve all concurrent edits.

Your bounded task is a read-only audit of the final release claims and evidence. Read `RELEASE_COORDINATION.md`, `BACKEND_E2E_VERIFICATION.md`, `REVIEWBOARD_VERIFICATION.md` and the eventual Windows release verification. Check that documented commands and paths exist, generated evidence has the stated run IDs, the limitations match actual supported target types, screenshots are real, and no private tokens, cookies or raw traces are included in public release documents. Do not print secrets if discovered; report the file and category privately in this chat.

You may write only `docs/RELEASE_EVIDENCE_REVIEW.md`, with concrete discrepancies and exact file references. Do not edit application, package, lock, fixture, native or build files. Do not rerun already passed full suites without a specific discrepancy. Do not submit or publish anything. Return findings to the owner/main chat; main will resolve product changes and decide review readiness.
