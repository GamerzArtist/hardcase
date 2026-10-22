# Disposable fixture contract and seeded defects

Every engine fixture run creates a fresh SQLite database in its run directory and an ephemeral `127.0.0.1` server. State resets before each independent scenario and reproduction attempt. The standalone CLI is for inspection only; its local state survives until the owner removes its explicitly configured directory.

The browser page is a minimal testing target, not the product frontend. It provides a notes form, a draft field, navigation and status text. Its HTML/JavaScript runs in real Chromium.

| Scenario | Declared policy | Faulty observation | Clean control |
|---|---|---|---|
| `normal.workflow` | One valid note survives reload; navigation, focus and narrow layout work | Passes | Passes |
| `normal.persistence` | Acknowledged draft write survives reload | `PUT /api/draft` says saved but GET/reload returns empty | SQLite stores the draft |
| `chaos.duplicates` | Repeating one operation creates one note | Double click submits the same key twice and creates two rows | Server deduplicates by operation ID |
| `chaos.boundaries` | Invalid inputs fail; retry after interruption is idempotent | Empty/long inputs are correctly rejected, but retry produces two rows | Retry returns the existing row |
| `hostile.authorization` | Viewer cannot POST admin reset; admin can | Viewer gets 200 and protected-action counter increments | Viewer gets 403 with no effect |
| `hostile.cost` | Ceiling 100 simulated units; repeated ID charges once | Three 60-unit requests spend 180 units | Duplicate is free; second distinct request gets 402; spent remains 60 |
| `siege.bounded` | Queue capacity one, event-window cap four, event IDs deduplicate | No overload rejection, queue peak two, repeated event applied multiple times | 429 under sufficient load, queue at most one, duplicate applied once, subsequent recovery succeeds |
| `breakpoint.recovery` | Rejected/outage/timeout/write-failure operations do not mutate balances; recovery commits once | Debit occurs before failure; balance + ledger drops below 100 | Outages/timeouts exhaust two attempts without mutation; write rolls back; recovery preserves 100 |

The engine confirms a defect only after the same failed assertion recurs from a reset state. JSON actions include expected/observed counters and HTTP status facts. Browser scenarios additionally save PNG screenshots, console metadata and Playwright traces. The fixture's `/api/policy` exposes the exact permission, queue and spending policy used by assertions.

## Safe manual observations

After `npm run fixture`, use `GET http://127.0.0.1:4319/api/state` to inspect synthetic counters. `GET /api/policy` provides expected invariants. POST `/api/admin/reset` with the predefined `x-test-role: viewer` or `admin` header demonstrates the permission contract. This is a simulated identity boundary, not real user authentication.

POST `/api/ai` accepts `{ "tokens": 60, "operationId": "one" }`; repeat it, then use another operation ID. It only updates in-memory synthetic billing counters. POST `/api/events` accepts `{ "eventId": "one", "simulatedVolume": 10 }`. Simulated volume is a logical payload value, not a multiplier on network requests.

Dependency outage, timeout and failed-write switches are available **only through the fixture's in-process handle** used by engine/tests. There is no public fault-injection HTTP endpoint. Financial transfers are local integer-balance fixtures and never invoke a bank, payment API or model provider.
