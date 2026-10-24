# Unified deployment

Canonical root: `D:/Code stuff/HACKATHON-PROJECTS/TEAM/hackathon-project-02`, branch `codex/hardcase-release`. Frontend: `apps/web`. No backend logic was moved or rewritten; existing Git history and the old frontend sibling remain intact.

## One-process entry point

`npm ci`, `npx playwright install chromium`, `npm run build`, `npm start`. Development is `npm run dev`. `scripts/local-app.mjs` starts the private engine, waits for its listening session, then serves the SPA and proxies `/api/v1/*` to the owned loopback engine. Authenticated SSE, artifact streaming and idempotency headers pass through the proxy. `/healthz` forwards the authenticated readiness check. The engine still owns validation, authorization, persistence and workers. SIGINT/SIGTERM close HTTP connections and the engine.

Only the application port is exposed. `HARDCASE_WEB_PORT` defaults to 4327. Persist `ENGINE_DATA_DIR` including the database and artifacts. A single Node replica owns this SQLite directory; do not mount one directory across multiple independent writers. Chromium processes require sufficient memory, disk and process lifetime. Static-only hosting and short-lived serverless functions are incompatible.

## Container workflow (not built in this environment)

Docker is not installed on the verification machine. The checked-in Dockerfile installs the pinned workspace dependencies and Chromium/system packages, builds both workspaces and runs as the Node user.

```
docker build -t hardcase .
docker run --init --shm-size=1g -p 127.0.0.1:4327:4327 -v hardcase-data:/var/lib/hardcase hardcase
```

For a remote deployment, set `HARDCASE_PUBLIC_ORIGIN=https://your-host` and a random server-side `HARDCASE_GATEWAY_SECRET` of at least 32 characters. Keep the secret out of browser code. Public mode binds the application port to the container interface, validates the configured Host and refuses EVERY request without a matching `X-Hardcase-Gateway` header. The engine remains loopback-only. CSP allows API connections only to the same application origin.

Place the service behind a TLS reverse proxy with an authenticated access policy (for example an existing OIDC access gateway). After authenticating the judge, that proxy MUST strip any client-supplied `X-Hardcase-Gateway` header and inject the server-side secret on upstream requests. Do not expose the container directly or use a proxy that injects the secret before authenticating users. Forward the configured public Host. Forward streaming responses without buffering and permit long-running SSE connections. Browser requests retain their engine bearer Authorization header; gateway authentication should use its own HttpOnly session cookie, not overwrite that header.

The access gateway, DNS, TLS, deployment credentials and hosted runner capacity are operator integrations, not supplied capabilities. No actual public endpoint or remote TLS/browser run was verified. Astra must review this new ingress boundary and run the container/public smoke before describing public deployment as ready. The local single-origin journey is verified separately in the frontend handoff.
