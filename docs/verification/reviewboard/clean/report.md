# Application testing report

Run: b347d0f5-af25-4abd-ab45-1a461392435e  
State: **completed**  
Engine: 0.1.0  

This report covers only the executed scenarios and declared assertions. Passing does not establish that the application is safe, secure, or bug-free.

Executed 3 scenarios: 3 passed, 0 confirmed, 0 intermittent, 0 suspected, 0 inconclusive.

Actual network requests: 39. Simulated event units: 0. Server errors: 0; rejected responses: 0. These counts measure different things.

Environment: {"engineVersion":"0.1.0","nodeVersion":"v24.11.1","platform":"win32","targetKind":"loopback","targetOrigin":"http://127.0.0.1:51980","isolated":false,"browserVersion":"156.0.8078.4"}

## Coverage

| Level | Execution | Scenarios |
|---|---|---|
| 1 NORMAL | Real Chromium browser execution | reviewboard.viewer-status, reviewboard.editor-persistence, reviewboard.login-recovery |

## Findings

### Viewer cannot complete a task or persist an unauthorized change

Level 1; **passed**; outcome passed; severity unassigned; source application.

Expected: Jamie is a read-only viewer. The server must reject the status change with HTTP 403, display the denial, and leave Review access rules in Todo before and after reload.

Observed: 4 explicit assertions passed.

Attempts: 1. Evidence: 3d3ebbdc-8a6f-4c69-889a-377551c3671e, c8fac91c-3140-4ea9-b376-c1fa2679e784, 4b815180-e10c-46d6-89b8-3903643abdeb, 20ca5565-8c90-483c-9838-0e5b442ff640, fa0dc7c9-89d9-41d1-b399-550c7bde718a.

Severity rationale: No application defect is established by this result.

Verified reproduction: no; retested: no.

Attempt 1: passed, 2662 ms; 4/4 assertions passed.

Reproduce: Use the stored local scenario and explicitly authorize a new run; automatic replay is unavailable for this target.

Limitations: Custom assertions reflect the user-supplied contract. Automatic reproduction is disabled for user-owned applications to avoid repeating mutations.

### Editor creates and completes a task that survives reload

Level 1; **passed**; outcome passed; severity unassigned; source application.

Expected: An authenticated editor can create and complete a new task. The title and Done status survive reload, the cookie restores the editor session, and searching returns the saved task.

Observed: 4 explicit assertions passed.

Attempts: 1. Evidence: 9e8325e9-a791-4aa1-9eaa-cb1c7b586e70, 1c2f837f-0ada-49ed-951b-8e1d244a374d, 80489581-8ac2-40be-aae1-b724c484a282, b9036796-374e-433c-82ff-0f33bacb4b27, f40a4c44-8b0c-490d-91af-2d078f8d215c.

Severity rationale: No application defect is established by this result.

Verified reproduction: no; retested: no.

Attempt 1: passed, 2824 ms; 4/4 assertions passed.

Reproduce: Use the stored local scenario and explicitly authorize a new run; automatic replay is unavailable for this target.

Limitations: Custom assertions reflect the user-supplied contract. Automatic reproduction is disabled for user-owned applications to avoid repeating mutations.

### Invalid login recovers and logout revokes the session

Level 1; **passed**; outcome passed; severity unassigned; source application.

Expected: Invalid credentials produce an actionable error. The user can correct them, sign in, sign out, and reload without regaining access to the board.

Observed: 3 explicit assertions passed.

Attempts: 1. Evidence: 1c898621-76a8-4413-be88-af5633a870f0, eb393c6b-b0ab-4732-895e-1ad7580839b2, a00c1e33-4714-47df-a24b-ca9f594e77d9, 3fb941c6-cbb2-4f21-8316-4f44556fd5dc, 457c235d-a58d-47c6-9f53-915edfe9054d.

Severity rationale: No application defect is established by this result.

Verified reproduction: no; retested: no.

Attempt 1: passed, 3023 ms; 3/3 assertions passed.

Reproduce: Use the stored local scenario and explicitly authorize a new run; automatic replay is unavailable for this target.

Limitations: Custom assertions reflect the user-supplied contract. Automatic reproduction is disabled for user-owned applications to avoid repeating mutations.

## Incomplete coverage

Unexecuted: none. Skipped: 0. Blocked: 0. Infrastructure errors: 0.

Run error: none

## AI

Status: disabled. Deterministic execution; AI analysis is disabled.

## Artifact privacy

Action and metadata JSON are redacted. Screenshots and traces can contain sensitive page data and are local-only, authenticated artifacts; raw traces cannot be reliably redacted automatically.
