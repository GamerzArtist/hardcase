# Disposable fixture contract and seeded defects

Every engine fixture run creates a fresh SQLite database in its run directory and an ephemeral `127.0.0.1` server. State resets before each independent scenario and reproduction attempt. The standalone CLI is for inspection only; its local state survives until the owner removes its explicitly configured directory.

The browser page is a minimal testing target, not the product frontend. It provides a notes form, a draft field, navigation and status text. Its HTML/JavaScript runs in real Chromium.

`/permissions` is the source-linked permission demonstrator. `hostile.authorization` version2 clicks its viewer/admin buttons in Chromium, reads the returned HTTP status and protected-state counter, and captures the actual rendered page. `src/fixtures/app.ts` contains both the page and the deliberately faulty/clean `POST /api/admin/reset` handler; `src/strategies/execute.ts` contains the assertions. Actions evidence records these source references, timestamps and selectors. This is real HTTP behavior with synthetic identities; no production authentication integration is implied.

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

After `npm run build:api` and `npm run fixture`, open `http://127.0.0.1:4319/permissions`. Click the viewer button: the faulty variant returns200 and increments the counter even though the displayed policy requires403 and no change. The admin control returns200 as allowed. Stop the fixture, use a fresh `FIXTURE_DATA_DIR`, and run `npm run fixture -- --clean`: viewer returns403 without a side effect, while admin succeeds. `GET http://127.0.0.1:4319/api/state` inspects synthetic counters; `GET /api/policy` provides expected invariants. The predefined `x-test-role: viewer|admin` header is a synthetic identity boundary, not real user authentication.

POST `/api/ai` accepts `{ "tokens": 60, "operationId": "one" }`; repeat it, then use another operation ID. It only updates in-memory synthetic billing counters. POST `/api/events` accepts `{ "eventId": "one", "simulatedVolume": 10 }`. Simulated volume is a logical payload value, not a multiplier on network requests.

Dependency outage, timeout and failed-write switches are available **only through the fixture's in-process handle** used by engine/tests. There is no public fault-injection HTTP endpoint. Financial transfers are local integer-balance fixtures and never invoke a bank, payment API or model provider.
