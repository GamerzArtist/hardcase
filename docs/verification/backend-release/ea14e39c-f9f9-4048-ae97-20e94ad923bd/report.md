# Application testing report

Run: ea14e39c-f9f9-4048-ae97-20e94ad923bd  
State: **completed**  
Engine: 0.1.0  

This report covers only the executed scenarios and declared assertions. Passing does not establish that the application is safe, secure, or bug-free.

Executed 8 scenarios: 8 passed, 0 confirmed, 0 intermittent, 0 suspected, 0 inconclusive.

Actual network requests: 82. Simulated event units: 81. Server errors: 3; rejected responses: 8. These counts measure different things.

Environment: {"engineVersion":"0.1.0","nodeVersion":"v24.11.1","platform":"win32","targetKind":"fixture","fixtureVariant":"clean","targetOrigin":"http://127.0.0.1:53065","isolated":true,"browserVersion":"156.0.8078.4"}

## Coverage

| Level | Execution | Scenarios |
|---|---|---|
| 1 NORMAL | Real Chromium browser execution | normal.workflow, normal.persistence |
| 2 CHAOS | Real Chromium browser execution | chaos.duplicates, chaos.boundaries |
| 3 HOSTILE | Real Chromium permission interaction and local HTTP against synthetic fixture policies | hostile.authorization, hostile.cost |
| 4 SIEGE | Real local HTTP execution against synthetic fixture policy and fault controls | siege.bounded |
| 5 BREAKPOINT | Real local HTTP execution against synthetic fixture policy and fault controls | breakpoint.recovery |

## Findings

### Save, reload, navigate, keyboard and narrow viewport

Level 1; **passed**; outcome passed; severity unassigned; source application.

Expected: A valid note survives refresh and basic navigation remains usable.

Observed: 9 explicit assertions passed.

Attempts: 1. Evidence: 7c53d0f8-65bc-4f43-919b-383f71e1951b, 8a7132c0-ab08-4d3b-bde5-b78f337ee541, f29fd7b2-8f7f-4738-96a4-61c0dd6ee7cb, ba91264c-1c2d-4a1e-bcdb-af68bee83b55, 22abcb87-031b-446e-82be-684dc542d7ed.

Severity rationale: No application defect is established by this result.

Verified reproduction: no; retested: no.

Attempt 1: passed, 2024 ms; 9/9 assertions passed.

Reproduce: POST /v1/runs/ea14e39c-f9f9-4048-ae97-20e94ad923bd/replay with {"scenarioIds":["normal.workflow"]}. A fresh disposable fixture of the same variant is created.

Limitations: Assertions apply to the declared fixture contract, not arbitrary application semantics.

### Acknowledged draft survives reload

Level 1; **passed**; outcome passed; severity unassigned; source application.

Expected: A successful save acknowledgement corresponds to durable draft data.

Observed: 2 explicit assertions passed.

Attempts: 1. Evidence: 49e3bbfb-3f1a-4107-a223-82f805099158, 7246c66f-d987-42be-b558-750f8957d6eb, a956b99e-fc6b-413a-935d-cdd4efaa27d2, 9ffffa00-dcdb-445c-9fbf-385917cb70b5, 08c1da79-8119-47c2-9da8-28ff08e71a68.

Severity rationale: No application defect is established by this result.

Verified reproduction: no; retested: no.

Attempt 1: passed, 775 ms; 2/2 assertions passed.

Reproduce: POST /v1/runs/ea14e39c-f9f9-4048-ae97-20e94ad923bd/replay with {"scenarioIds":["normal.persistence"]}. A fresh disposable fixture of the same variant is created.

Limitations: Assertions apply to the declared fixture contract, not arbitrary application semantics.

### Repeated submissions and shared-tab state

Level 2; **passed**; outcome passed; severity unassigned; source application.

Expected: One logical submission creates exactly one record, visible in both tabs.

Observed: 2 explicit assertions passed.

Attempts: 1. Evidence: 455ae029-4ed4-42d3-8cd6-2fd57ace9f06, 38e9cb25-a443-492b-bd84-1cdc4009303b, af23f127-0a6f-4ca4-b32f-d3ff8d736e6e, 069b2fd3-369c-420d-9ffe-6b9e8dc29bd1, 0aee8aad-9cb2-451b-9bb9-2194b6826d58.

Severity rationale: No application defect is established by this result.

Verified reproduction: no; retested: no.

Attempt 1: passed, 1356 ms; 2/2 assertions passed.

Reproduce: POST /v1/runs/ea14e39c-f9f9-4048-ae97-20e94ad923bd/replay with {"scenarioIds":["chaos.duplicates"]}. A fresh disposable fixture of the same variant is created.

Limitations: Assertions apply to the declared fixture contract, not arbitrary application semantics.

### Invalid input, delay, interruption and retry

Level 2; **passed**; outcome passed; severity unassigned; source application.

Expected: Invalid values are rejected; interrupted retries persist exactly one operation.

Observed: 5 explicit assertions passed.

Attempts: 1. Evidence: f7672fdd-dc28-419c-89fd-e431dd7d3039, 63c7b82c-afd8-417b-b2a1-2a67d4ffa901, 205e633f-b9fa-41a4-b673-9a06e361bb7b, 9b5bd1df-5b48-40d5-a05f-5a88d8347d09, ab244c62-eded-4291-aca1-a1f9832fc33b.

Severity rationale: No application defect is established by this result.

Verified reproduction: no; retested: no.

Attempt 1: passed, 1806 ms; 5/5 assertions passed.

Reproduce: POST /v1/runs/ea14e39c-f9f9-4048-ae97-20e94ad923bd/replay with {"scenarioIds":["chaos.boundaries"]}. A fresh disposable fixture of the same variant is created.

Limitations: Assertions apply to the declared fixture contract, not arbitrary application semantics.

### Server permission enforcement

Level 3; **passed**; outcome passed; severity unassigned; source application.

Expected: Viewer is denied with no side effects; admin succeeds under the explicit fixture policy.

Observed: 4 explicit assertions passed.

Attempts: 1. Evidence: 938ab812-4532-4137-8335-6a6d15ffaae4, bd7ce40f-7cc1-4b4e-a881-53e6678d55ef, 73d0910b-4412-431d-b063-31d62e53476f, c1ef83e5-75f2-45e9-a82c-195862a3fb52, b7f797e7-8a7f-4a2d-a218-9e519ccbe809.

Severity rationale: No application defect is established by this result.

Verified reproduction: no; retested: no.

Attempt 1: passed, 1111 ms; 4/4 assertions passed.

Reproduce: POST /v1/runs/ea14e39c-f9f9-4048-ae97-20e94ad923bd/replay with {"scenarioIds":["hostile.authorization"]}. A fresh disposable fixture of the same variant is created.

Limitations: Assertions apply to the declared fixture contract, not arbitrary application semantics. Synthetic fixture identities, counters and dependency failures; no real provider or billing traffic.

### Simulated token ceiling and idempotent billing

Level 3; **passed**; outcome passed; severity unassigned; source application.

Expected: Duplicate operations are not charged twice and simulated spend never exceeds 100 units.

Observed: 4 explicit assertions passed.

Attempts: 1. Evidence: 61f805e5-99f1-4d0b-8800-2459f08db0bf, 81fe3a9a-eb91-4fa2-9fef-53f70eaa2bd8.

Severity rationale: No application defect is established by this result.

Verified reproduction: no; retested: no.

Attempt 1: passed, 517 ms; 4/4 assertions passed.

Reproduce: POST /v1/runs/ea14e39c-f9f9-4048-ae97-20e94ad923bd/replay with {"scenarioIds":["hostile.cost"]}. A fresh disposable fixture of the same variant is created.

Limitations: Assertions apply to the declared fixture contract, not arbitrary application semantics. Synthetic fixture identities, counters and dependency failures; no real provider or billing traffic.

### Bounded event traffic, throttling, queue and recovery

Level 4; **passed**; outcome passed; severity unassigned; source application.

Expected: A bounded queue rejects overload, deduplicates accepted events, drains, and recovers.

Observed: 6 explicit assertions passed.

Attempts: 1. Evidence: 88ef6134-e9fb-4b30-9498-af52eb744e87, 5541aaa4-a171-4ee5-a1e2-2da6a05e86e5.

Severity rationale: No application defect is established by this result.

Verified reproduction: no; retested: no.

Attempt 1: passed, 2257 ms; 6/6 assertions passed.

Reproduce: POST /v1/runs/ea14e39c-f9f9-4048-ae97-20e94ad923bd/replay with {"scenarioIds":["siege.bounded"]}. A fresh disposable fixture of the same variant is created.

Limitations: Assertions apply to the declared fixture contract, not arbitrary application semantics. Synthetic fixture identities, counters and dependency failures; no real provider or billing traffic.

### Dependency outage, failed writes and integrity

Level 5; **passed**; outcome passed; severity unassigned; source application.

Expected: Failed operations leave state unchanged; recovered duplicate operations commit once and conserve value.

Observed: 13 explicit assertions passed.

Attempts: 1. Evidence: 6f235420-f3fb-43da-9a1c-5a6fc021da24, de8fc4a4-523c-4078-a4df-e23765bbc750.

Severity rationale: No application defect is established by this result.

Verified reproduction: no; retested: no.

Attempt 1: passed, 853 ms; 13/13 assertions passed.

Reproduce: POST /v1/runs/ea14e39c-f9f9-4048-ae97-20e94ad923bd/replay with {"scenarioIds":["breakpoint.recovery"]}. A fresh disposable fixture of the same variant is created.

Limitations: Assertions apply to the declared fixture contract, not arbitrary application semantics. Synthetic fixture identities, counters and dependency failures; no real provider or billing traffic.

## Incomplete coverage

Unexecuted: none. Skipped: 0. Blocked: 0. Infrastructure errors: 0.

Run error: none

## AI

Status: disabled. Deterministic execution; AI analysis is disabled.

## Artifact privacy

Action and metadata JSON are redacted. Screenshots and traces can contain sensitive page data and are local-only, authenticated artifacts; raw traces cannot be reliably redacted automatically.

## Regression comparison

Baseline: 754b4e25-30bc-4002-a243-8a917a863f55

| Scenario | Before | After | Change |
|---|---|---|---|
| normal.workflow | passed | passed | unchanged |
| normal.persistence | confirmed | passed | resolved_in_this_run |
| chaos.duplicates | confirmed | passed | resolved_in_this_run |
| chaos.boundaries | confirmed | passed | resolved_in_this_run |
| hostile.authorization | confirmed | passed | resolved_in_this_run |
| hostile.cost | confirmed | passed | resolved_in_this_run |
| siege.bounded | confirmed | passed | resolved_in_this_run |
| breakpoint.recovery | confirmed | passed | resolved_in_this_run |
