# Application testing report

Run: b6ca6c33-2dbe-43e6-8cfb-38f7c3a2a057  
State: **completed**  
Engine: 0.1.0  

This report covers only the executed scenarios and declared assertions. Passing does not establish that the application is safe, secure, or bug-free.

Executed 3 scenarios: 2 passed, 0 confirmed, 0 intermittent, 1 suspected, 0 inconclusive.

Actual network requests: 40. Simulated event units: 0. Server errors: 0; rejected responses: 0. These counts measure different things.

Environment: {"engineVersion":"0.1.0","nodeVersion":"v24.11.1","platform":"win32","targetKind":"loopback","targetOrigin":"http://127.0.0.1:51980","isolated":false,"browserVersion":"156.0.8078.4"}

## Coverage

| Level | Execution | Scenarios |
|---|---|---|
| 1 NORMAL | Real Chromium browser execution | reviewboard.viewer-status, reviewboard.editor-persistence, reviewboard.login-recovery |

## Findings

### Viewer cannot complete a task or persist an unauthorized change

Level 1; **suspected**; outcome failed; severity unassigned; source application.

Expected: Jamie is a read-only viewer. The server must reject the status change with HTTP 403, display the denial, and leave Review access rules in Todo before and after reload.

Observed: The viewer sees the server's permission denial.: expected "Viewers cannot change task status.", observed "Task moved to Done."; Denied changes do not update the current board.: expected "Todo", observed "Done"; Reloading retrieves the unchanged task from SQLite.: expected "Todo", observed "Done"

Attempts: 1. Evidence: 779d9478-e809-45c9-bea3-05798a2cde57, b941b3ef-3494-4ad8-a393-6fbc627c0d8f, 9745e7e6-8c48-42f5-935f-fdfed6027bfa, 051b1100-9893-4e1d-ad6d-e0925328b526, 66941507-ec54-445e-a45f-c260ca14cf0b.

Severity rationale: Custom assertion failure has no independently defined impact policy; severity remains unassigned.

Verified reproduction: no; retested: no.

Attempt 1: failed, 2691 ms; 1/4 assertions passed.

Hypothesized cause: The server may be trusting client identity without applying the declared permission rule.

Suggested remediation (unverified): Inspect the failed invariant at the server boundary and use validated, atomic state changes with bounded retries where applicable.

Required verification: Replay the failed scenario against the corrected isolated variant and confirm every previously failing assertion passes.

Reproduce: Use the stored local scenario and explicitly authorize a new run; automatic replay is unavailable for this target.

Limitations: Custom assertions reflect the user-supplied contract. Automatic reproduction is disabled for user-owned applications to avoid repeating mutations.

### Editor creates and completes a task that survives reload

Level 1; **passed**; outcome passed; severity unassigned; source application.

Expected: An authenticated editor can create and complete a new task. The title and Done status survive reload, the cookie restores the editor session, and searching returns the saved task.

Observed: 4 explicit assertions passed.

Attempts: 1. Evidence: a6a71c9a-bcf4-43cd-8ce3-1c3de249bb84, 0c61e0e4-f021-4300-8b2f-3018b9e6e4ad, 9b88dcff-b9cb-480b-bddc-806a2fcd4d71, 987d8c1b-d4ce-4a5c-b7b2-4c41aa8d636f, 6cb75b5b-6685-4fad-9774-34f57bbf774e.

Severity rationale: No application defect is established by this result.

Verified reproduction: no; retested: no.

Attempt 1: passed, 2848 ms; 4/4 assertions passed.

Reproduce: Use the stored local scenario and explicitly authorize a new run; automatic replay is unavailable for this target.

Limitations: Custom assertions reflect the user-supplied contract. Automatic reproduction is disabled for user-owned applications to avoid repeating mutations.

### Invalid login recovers and logout revokes the session

Level 1; **passed**; outcome passed; severity unassigned; source application.

Expected: Invalid credentials produce an actionable error. The user can correct them, sign in, sign out, and reload without regaining access to the board.

Observed: 3 explicit assertions passed.

Attempts: 1. Evidence: d715ac4d-c954-4971-8b9f-4d0be9697b65, 2eabd674-0ff8-4ae2-9f16-17683d314935, 78229966-56aa-45f4-8a01-1f2da761a2f3, 651e555a-6d2c-4cce-97cf-592d1cc2330c, 9550291c-d0ee-4db7-949f-30c32c032990.

Severity rationale: No application defect is established by this result.

Verified reproduction: no; retested: no.

Attempt 1: passed, 2985 ms; 3/3 assertions passed.

Reproduce: Use the stored local scenario and explicitly authorize a new run; automatic replay is unavailable for this target.

Limitations: Custom assertions reflect the user-supplied contract. Automatic reproduction is disabled for user-owned applications to avoid repeating mutations.

## Incomplete coverage

Unexecuted: none. Skipped: 0. Blocked: 0. Infrastructure errors: 0.

Run error: none

## AI

Status: disabled. Deterministic execution; AI analysis is disabled.

## Artifact privacy

Action and metadata JSON are redacted. Screenshots and traces can contain sensitive page data and are local-only, authenticated artifacts; raw traces cannot be reliably redacted automatically.
