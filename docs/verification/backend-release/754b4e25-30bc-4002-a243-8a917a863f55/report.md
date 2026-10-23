# Application testing report

Run: 754b4e25-30bc-4002-a243-8a917a863f55  
State: **completed**  
Engine: 0.1.0  

This report covers only the executed scenarios and declared assertions. Passing does not establish that the application is safe, secure, or bug-free.

Executed 8 scenarios: 1 passed, 7 confirmed, 0 intermittent, 0 suspected, 0 inconclusive.

Actual network requests: 148. Simulated event units: 162. Server errors: 6; rejected responses: 4. These counts measure different things.

Environment: {"engineVersion":"0.1.0","nodeVersion":"v24.11.1","platform":"win32","targetKind":"fixture","fixtureVariant":"faulty","targetOrigin":"http://127.0.0.1:60647","isolated":true,"browserVersion":"156.0.8078.4"}

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

Attempts: 1. Evidence: e8e6766b-b9a4-4f06-90fe-4e9889bbb993, fca28e03-a055-409e-89ef-d4751b0f7b11, 25b20e08-9bea-40e1-b31d-ad3a1193c83d, d58e31a8-d05c-4791-9fc0-03c6bd18b907, aa6696fa-62ce-4014-a4dc-d3d9aac00e99.

Severity rationale: No application defect is established by this result.

Verified reproduction: no; retested: no.

Attempt 1: passed, 1887 ms; 9/9 assertions passed.

Reproduce: POST /v1/runs/754b4e25-30bc-4002-a243-8a917a863f55/replay with {"scenarioIds":["normal.workflow"]}. A fresh disposable fixture of the same variant is created.

Limitations: Assertions apply to the declared fixture contract, not arbitrary application semantics.

### Acknowledged draft survives reload

Level 1; **confirmed**; outcome failed; severity medium; source application.

Expected: A successful save acknowledgement corresponds to durable draft data.

Observed: Acknowledged draft survives refresh: expected "Durable synthetic draft", observed ""

Attempts: 2. Evidence: ae7720f2-eb44-4775-902f-c078c6ebcdcf, f2acd14d-9904-4b54-b495-156b29be456a, d7f6aaa2-66c3-427d-a2ca-0d9e4fcb64cc, 8c4f9f68-9947-4b33-9de7-177e3787f450, 66c94ecc-cc66-495c-b6e8-aa6318a75b56, 0ca1a10d-9fe2-48f7-ad74-ce995bdd41d6, db0e16f2-9fc8-4775-9110-9bc95582ed66, f5365e61-ac66-45be-bf21-b69ed763cf1e, d8aaf61c-4f7e-4cae-bb2f-71ae4059f35f, d600b51a-1103-4893-9c0f-7c2ab6c343a7.

Severity rationale: A declared data-integrity, idempotency, or bounded-resilience invariant failed in the disposable fixture. Impact is scoped to that demonstrated contract.

Verified reproduction: yes; retested: yes.

Attempt 1: failed, 811 ms; 1/2 assertions passed.

Attempt 2: failed, 837 ms; 1/2 assertions passed.

Hypothesized cause: The acknowledgement may precede a durable write.

Suggested remediation (unverified): Inspect the failed invariant at the server boundary and use validated, atomic state changes with bounded retries where applicable.

Required verification: Replay the failed scenario against the corrected isolated variant and confirm every previously failing assertion passes.

Reproduce: POST /v1/runs/754b4e25-30bc-4002-a243-8a917a863f55/replay with {"scenarioIds":["normal.persistence"]}. A fresh disposable fixture of the same variant is created.

Limitations: Assertions apply to the declared fixture contract, not arbitrary application semantics.

### Repeated submissions and shared-tab state

Level 2; **confirmed**; outcome failed; severity medium; source application.

Expected: One logical submission creates exactly one record, visible in both tabs.

Observed: Repeated submission creates exactly one record: expected 1, observed 2

Attempts: 2. Evidence: ff815131-1019-4322-8e9e-683e6e9fa8c4, 611481c2-b2e0-45b4-a508-bceff5588e4d, 42249b0e-80d3-4a04-acbf-4f91ac28ba2b, fb0c1878-903d-43e7-842d-a570ed9e4b5e, 7c507d24-f575-41fa-86c7-13d0c6251b86, c5384363-6cf1-44c7-9987-f0d22dc450f6, 34c51ef5-fdd2-4007-93b3-dc427f11fe83, 602dd411-4660-4d61-9d5f-89291546730a, 447a1640-c6ba-4ca2-b87f-c85441740097, 8b0d0c5e-5812-48ed-801d-77474bcab7bd.

Severity rationale: A declared data-integrity, idempotency, or bounded-resilience invariant failed in the disposable fixture. Impact is scoped to that demonstrated contract.

Verified reproduction: yes; retested: yes.

Attempt 1: failed, 1340 ms; 1/2 assertions passed.

Attempt 2: failed, 1348 ms; 1/2 assertions passed.

Hypothesized cause: Repeated operations may lack a stable key and atomic deduplication.

Suggested remediation (unverified): Inspect the failed invariant at the server boundary and use validated, atomic state changes with bounded retries where applicable.

Required verification: Replay the failed scenario against the corrected isolated variant and confirm every previously failing assertion passes.

Reproduce: POST /v1/runs/754b4e25-30bc-4002-a243-8a917a863f55/replay with {"scenarioIds":["chaos.duplicates"]}. A fresh disposable fixture of the same variant is created.

Limitations: Assertions apply to the declared fixture contract, not arbitrary application semantics.

### Invalid input, delay, interruption and retry

Level 2; **confirmed**; outcome failed; severity medium; source application.

Expected: Invalid values are rejected; interrupted retries persist exactly one operation.

Observed: Retry creates one logical record: expected 1, observed 2

Attempts: 2. Evidence: 3a570144-7f56-4742-84a4-c3a1e29472a0, 62c708a2-7c0f-4956-aa86-5a20380bb2b9, f1f59d72-98b4-4c41-9e67-52fa8d7f7ae2, 1e19ed17-b7ca-4b33-8eba-98c8e9fb636a, c1457bb3-86d6-495a-9621-bf83cd3b76c7, 986182cf-3d29-448f-a462-ce303a95a7bd, 6f19c36d-021d-4aff-aa12-28a892f60664, 114ec9ec-4777-4387-8cfb-078579abf800, 1824efbb-d58d-47f3-b73e-25d88958ccf6, f902a161-923c-42e5-8a70-8a73639e4e85.

Severity rationale: A declared data-integrity, idempotency, or bounded-resilience invariant failed in the disposable fixture. Impact is scoped to that demonstrated contract.

Verified reproduction: yes; retested: yes.

Attempt 1: failed, 1801 ms; 4/5 assertions passed.

Attempt 2: failed, 1844 ms; 4/5 assertions passed.

Hypothesized cause: Observed behavior differs from the declared assertion; inspect the captured action sequence.

Suggested remediation (unverified): Inspect the failed invariant at the server boundary and use validated, atomic state changes with bounded retries where applicable.

Required verification: Replay the failed scenario against the corrected isolated variant and confirm every previously failing assertion passes.

Reproduce: POST /v1/runs/754b4e25-30bc-4002-a243-8a917a863f55/replay with {"scenarioIds":["chaos.boundaries"]}. A fresh disposable fixture of the same variant is created.

Limitations: Assertions apply to the declared fixture contract, not arbitrary application semantics.

### Server permission enforcement

Level 3; **confirmed**; outcome failed; severity high; source application.

Expected: Viewer is denied with no side effects; admin succeeds under the explicit fixture policy.

Observed: Viewer must be denied server-side: expected 403, observed 200; Denied identity must not mutate protected state: expected 0, observed 1

Attempts: 2. Evidence: ed96240f-9a72-4e57-ac6f-f0942658b017, 2e416f78-bfd8-4fd4-bbbc-693cb73cf455, a32073dd-87d6-4b69-a394-b9bba0043969, 594d1ec8-2c71-4a8a-b61b-19d8e63a7e81, 82a1e810-545f-4bd4-9171-94591cd9f4ee, 5bb2181b-75f7-463d-b0bf-f17078d829b3, 7545f149-6cab-4ed1-b7b4-ecd4b0e014e3, 8f5d175e-5b9e-453c-8aac-bb0eaff69071, 85f42bee-716b-425d-86f3-6e6e40c857e3, 816fbb5a-3020-414d-ad37-4bb1ff6282d1.

Severity rationale: The explicit synthetic fixture policy allowed a protected action or exceeded a simulated cost limit. High impact within that fixture contract; no production financial impact is claimed.

Verified reproduction: yes; retested: yes.

Attempt 1: failed, 982 ms; 2/4 assertions passed.

Attempt 2: failed, 987 ms; 2/4 assertions passed.

Hypothesized cause: The server may be trusting client identity without applying the declared permission rule.

Suggested remediation (unverified): Inspect the failed invariant at the server boundary and use validated, atomic state changes with bounded retries where applicable.

Required verification: Replay the failed scenario against the corrected isolated variant and confirm every previously failing assertion passes.

Reproduce: POST /v1/runs/754b4e25-30bc-4002-a243-8a917a863f55/replay with {"scenarioIds":["hostile.authorization"]}. A fresh disposable fixture of the same variant is created.

Limitations: Assertions apply to the declared fixture contract, not arbitrary application semantics. Synthetic fixture identities, counters and dependency failures; no real provider or billing traffic.

### Simulated token ceiling and idempotent billing

Level 3; **confirmed**; outcome failed; severity high; source application.

Expected: Duplicate operations are not charged twice and simulated spend never exceeds 100 units.

Observed: Duplicate operation charges only once: expected 60, observed 120; Over-ceiling request is rejected: expected 402, observed 200; Synthetic cost never exceeds the configured ceiling: expected true, observed false; Accepted billable operation counter remains one: expected 1, observed 3

Attempts: 2. Evidence: edca456f-70af-4514-b092-028c604817a3, b1ddee57-6b68-4af4-8e69-3219d4fd6a46, 04208644-ec48-44ba-a548-5d44a1ea7905, c9b5f357-75db-4434-85aa-6ee710291bed.

Severity rationale: The explicit synthetic fixture policy allowed a protected action or exceeded a simulated cost limit. High impact within that fixture contract; no production financial impact is claimed.

Verified reproduction: yes; retested: yes.

Attempt 1: failed, 513 ms; 0/4 assertions passed.

Attempt 2: failed, 596 ms; 0/4 assertions passed.

Hypothesized cause: Budget reservation and idempotency may not be enforced atomically.

Suggested remediation (unverified): Inspect the failed invariant at the server boundary and use validated, atomic state changes with bounded retries where applicable.

Required verification: Replay the failed scenario against the corrected isolated variant and confirm every previously failing assertion passes.

Reproduce: POST /v1/runs/754b4e25-30bc-4002-a243-8a917a863f55/replay with {"scenarioIds":["hostile.cost"]}. A fresh disposable fixture of the same variant is created.

Limitations: Assertions apply to the declared fixture contract, not arbitrary application semantics. Synthetic fixture identities, counters and dependency failures; no real provider or billing traffic.

### Bounded event traffic, throttling, queue and recovery

Level 4; **confirmed**; outcome failed; severity medium; source application.

Expected: A bounded queue rejects overload, deduplicates accepted events, drains, and recovers.

Observed: Over-capacity fixture rejects some requests: expected true, observed false; Queue peak does not exceed declared capacity: expected true, observed false; Duplicate accepted events are applied once: expected 1, observed 8

Attempts: 2. Evidence: 1771ef2c-40e2-454d-876b-9a12ad82f537, ddc4e575-9a37-49c2-9664-c67a09d097c8, 9e49abec-f2d0-4b7e-a6da-7984b2d26bc8, 610f00d4-86c3-4766-b2be-69c368d4efaa.

Severity rationale: A declared data-integrity, idempotency, or bounded-resilience invariant failed in the disposable fixture. Impact is scoped to that demonstrated contract.

Verified reproduction: yes; retested: yes.

Attempt 1: failed, 2612 ms; 3/6 assertions passed.

Attempt 2: failed, 2508 ms; 3/6 assertions passed.

Hypothesized cause: Queue admission, throttling or event deduplication may be missing.

Suggested remediation (unverified): Inspect the failed invariant at the server boundary and use validated, atomic state changes with bounded retries where applicable.

Required verification: Replay the failed scenario against the corrected isolated variant and confirm every previously failing assertion passes.

Reproduce: POST /v1/runs/754b4e25-30bc-4002-a243-8a917a863f55/replay with {"scenarioIds":["siege.bounded"]}. A fresh disposable fixture of the same variant is created.

Limitations: Assertions apply to the declared fixture contract, not arbitrary application semantics. Synthetic fixture identities, counters and dependency failures; no real provider or billing traffic.

### Dependency outage, failed writes and integrity

Level 5; **confirmed**; outcome failed; severity medium; source application.

Expected: Failed operations leave state unchanged; recovered duplicate operations commit once and conserve value.

Observed: Rejected operation leaves balance unchanged: expected 100, observed 90; Timed-out operation leaves balance unchanged: expected 100, observed 80; Failed write leaves balance unchanged: expected 100, observed 70; Balance plus ledger preserves initial value: expected 100, observed 70

Attempts: 2. Evidence: c28ec61e-63fa-4c67-ba16-096011e3b69a, 899b388c-67d4-4490-8744-724c0d4307e7, 312ebcec-4650-4829-95b7-ebbd5dcc2af6, b79d9ee2-84d5-493e-97a9-9709885339ce.

Severity rationale: A declared data-integrity, idempotency, or bounded-resilience invariant failed in the disposable fixture. Impact is scoped to that demonstrated contract.

Verified reproduction: yes; retested: yes.

Attempt 1: failed, 874 ms; 9/13 assertions passed.

Attempt 2: failed, 948 ms; 9/13 assertions passed.

Hypothesized cause: State may be mutated before dependency success or outside a transaction.

Suggested remediation (unverified): Inspect the failed invariant at the server boundary and use validated, atomic state changes with bounded retries where applicable.

Required verification: Replay the failed scenario against the corrected isolated variant and confirm every previously failing assertion passes.

Reproduce: POST /v1/runs/754b4e25-30bc-4002-a243-8a917a863f55/replay with {"scenarioIds":["breakpoint.recovery"]}. A fresh disposable fixture of the same variant is created.

Limitations: Assertions apply to the declared fixture contract, not arbitrary application semantics. Synthetic fixture identities, counters and dependency failures; no real provider or billing traffic.

## Incomplete coverage

Unexecuted: none. Skipped: 0. Blocked: 0. Infrastructure errors: 0.

Run error: none

## AI

Status: disabled. Deterministic execution; AI analysis is disabled.

## Artifact privacy

Action and metadata JSON are redacted. Screenshots and traces can contain sensitive page data and are local-only, authenticated artifacts; raw traces cannot be reliably redacted automatically.
