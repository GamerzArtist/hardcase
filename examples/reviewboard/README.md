# Reviewboard MVP

A separate, working task board used to evaluate Hardcase against an application outside its built-in fixture. It has real password verification, HttpOnly session cookies, two roles, task creation/completion, search, an activity log, and durable SQLite storage. It imports no Hardcase code. All accounts and records are synthetic.

## Run the application

From the repository root, after installing the existing dependencies:

```powershell
node examples/reviewboard/server.mjs
```

Open http://127.0.0.1:4401. Sign in as `alex` (editor) or `jamie` (viewer), both with the public demo password `reviewboard-demo`. Editors can create and complete tasks. Viewers can read; trying to complete a task produces a server-side 403 with a visible explanation. The button remains available so this enforcement can be tested through the browser.

The default is the corrected application. To reproduce the deliberately seeded defect, stop it, choose a **new** data directory, and start faulty mode:

```powershell
$env:REVIEWBOARD_DATA_DIR = '.engine/reviewboard/owner-faulty-01'
node examples/reviewboard/server.mjs --faulty
```

Sign in as Jamie, click **Move to done** on **Review access rules**, and reload. In faulty mode the status becomes Done and persists. Only that route's role check is omitted: authentication, origin checking, input validation and optimistic concurrency remain enabled. Faulty mode is an explicit local demonstration, never a deployment configuration.

For a clean comparison, stop the server and use another new directory with no `--faulty`. Existing directories intentionally preserve tasks and sessions. `REVIEWBOARD_PORT` optionally changes the port. The server always binds to 127.0.0.1.

## Test it with Hardcase

The three files in `scenarios/` are real version-1 custom scenario definitions. Use the owned loopback target, acknowledge ownership, and select Level 1:

- `viewer-status.json`: real viewer login, attempt a change, inspect denial and saved state after reload.
- `editor-persistence.json`: create, complete, reload, check saved data and search.
- `login-recovery.json`: invalid login, corrected credentials, logout and reload.

Use a fresh database for the complete suite: the editor scenario expects the two seeded tasks and creates task 3. The API accepts these definitions in `scenarios` on `POST /v1/runs`; validate each with `POST /v1/scenarios/validate`. The app origin must be explicitly listed in `approvedOrigins`. No AI provider is involved.

To execute the complete evaluation and export real evidence:

```powershell
npm run build:api
node examples/reviewboard/verify.mjs
```

The driver first opens the real MVP in Chromium to check desktop/mobile interactions and session enforcement. It then starts the actual Hardcase API and worker, submits three browser scenarios against faulty mode, independently reproduces the permission defect against a fresh database, and runs the three scenarios against clean mode. It downloads and verifies evidence hashes and independently reads the resulting SQLite tasks. It does not mock the browser, authentication, HTTP server, worker or database.

Results are written to a unique `.engine/reviewboard/<timestamp>/reviewed-evidence` directory. Raw traces and session secrets stay in private engine storage. The exported JSON/Markdown, screenshots and sanitized actions/network/console logs contain synthetic data only. Keep any traces private because they can contain cookies.

Hardcase labels a failed owned-loopback scenario `suspected`, even when an independent second run matches. This evaluation preserves that honest classification. Automatic replay remains restricted to disposable engine fixtures; the evaluation explicitly starts a new authorized run and fresh application database.

Recorded result: [MVP verification](../../docs/REVIEWBOARD_VERIFICATION.md).
