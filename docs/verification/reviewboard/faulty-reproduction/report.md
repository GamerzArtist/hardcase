# Application testing report

Run: 48e24cff-6f8d-46dd-abd3-9c608547cabc  
State: **completed**  
Engine: 0.1.0  

This report covers only the executed scenarios and declared assertions. Passing does not establish that the application is safe, secure, or bug-free.

Executed 1 scenarios: 0 passed, 0 confirmed, 0 intermittent, 1 suspected, 0 inconclusive.

Actual network requests: 13. Simulated event units: 0. Server errors: 0; rejected responses: 0. These counts measure different things.

Environment: {"engineVersion":"0.1.0","nodeVersion":"v24.11.1","platform":"win32","targetKind":"loopback","targetOrigin":"http://127.0.0.1:51980","isolated":false,"browserVersion":"156.0.8078.4"}

## Coverage

| Level | Execution | Scenarios |
|---|---|---|
| 1 NORMAL | Real Chromium browser execution | reviewboard.viewer-status |

## Findings

### Viewer cannot complete a task or persist an unauthorized change

Level 1; **suspected**; outcome failed; severity unassigned; source application.

Expected: Jamie is a read-only viewer. The server must reject the status change with HTTP 403, display the denial, and leave Review access rules in Todo before and after reload.

Observed: The viewer sees the server's permission denial.: expected "Viewers cannot change task status.", observed "Task moved to Done."; Denied changes do not update the current board.: expected "Todo", observed "Done"; Reloading retrieves the unchanged task from SQLite.: expected "Todo", observed "Done"

Attempts: 1. Evidence: e6e9ab6c-a97a-4091-84d3-5f86edc364ee, ca9cb47c-3e2a-4977-a770-b73432471384, 2962aa0c-abbe-4b95-be43-17e6df97d5a3, e2316b1a-2d3e-4066-a543-2fb881d1ab08, c6b6262d-0d0d-419a-8a7c-f8a51d40b74d.

Severity rationale: Custom assertion failure has no independently defined impact policy; severity remains unassigned.

Verified reproduction: no; retested: no.

Attempt 1: failed, 2650 ms; 1/4 assertions passed.

Hypothesized cause: The server may be trusting client identity without applying the declared permission rule.

Suggested remediation (unverified): Inspect the failed invariant at the server boundary and use validated, atomic state changes with bounded retries where applicable.

Required verification: Replay the failed scenario against the corrected isolated variant and confirm every previously failing assertion passes.

Reproduce: Use the stored local scenario and explicitly authorize a new run; automatic replay is unavailable for this target.

Limitations: Custom assertions reflect the user-supplied contract. Automatic reproduction is disabled for user-owned applications to avoid repeating mutations.

## Incomplete coverage

Unexecuted: none. Skipped: 0. Blocked: 0. Infrastructure errors: 0.

Run error: none

## AI

Status: disabled. Deterministic execution; AI analysis is disabled.

## Artifact privacy

Action and metadata JSON are redacted. Screenshots and traces can contain sensitive page data and are local-only, authenticated artifacts; raw traces cannot be reliably redacted automatically.
