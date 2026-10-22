# Execution boundaries

The engine is a local test tool for applications the user controls, not an Internet scanner or malware-analysis sandbox. It binds only `127.0.0.1`. All routes except liveness require a local Bearer token. Host validation rejects DNS-rebinding hostnames. Cross-origin access is denied unless an exact local frontend origin is configured. Tokens are not accepted in URLs. Cloud accounts and Clerk are not dependencies.

Targets accept explicit HTTP ports 1024–65535 on `127.0.0.1`, `[::1]`, or `localhost` normalized to numeric IPv4. Public hosts, LAN addresses, link-local metadata services, alternate numeric IP encodings, DNS aliases, credentials in URLs and the active engine port are rejected. Each origin, including its port, must be approved. `acknowledgeOwnership: true` is mandatory for user-supplied targets. HTTPS/custom-domain staging, production apps and external providers are unsupported as test targets.

All five tiers enforce budgets. Levels 3–5 additionally require `allowFixtureFaults: true` and an engine-owned fixture; a user cannot confer that privilege on an arbitrary loopback application. Default creation selects only Levels 1–2. Fault controls are in-process fixture handles, not remotely callable administrative endpoints. No real billing, external AI consumption, account enumeration, public exploit scanning, production fault injection or third-party load testing occurs.

## Request and process limits

| Resource | Default | Hard maximum |
|---|---:|---:|
| Active runs | 1 | 2 |
| Queued runs | 20 | 20 |
| Run duration | 120 seconds | 180 seconds |
| Network requests per run | 300 | 400 |
| Concurrent network requests | 2 | 4; Siege additionally caps at 2 |
| Request rate | 10/second | 20/second, globally spaced per run |
| Individual network timeout | 4 seconds | 4 seconds |
| Response body | 1 MiB | 2 MiB |
| Persisted evidence bytes per run | 32 MiB | 64 MiB |
| Reproduction attempts | 1 initial + 1 reproduction | 2 |
| Browser pages per context | 2 | 2 |
| Custom scenarios / steps | 10 / 40 | 10 / 40 |
| API body / browser mutation body | 128 KiB / 16 KiB | same |
| Concurrent SSE subscribers | 20 | 20 |
| Worker V8 heap | 256 MiB | 256 MiB |

Global and custom-scenario request guards enforce count/rate/concurrency before target I/O. Service workers, downloads and WebSockets are blocked. Chromium traffic is fulfilled from a bounded manual HTTP fetch; redirects are refused before Chromium can follow them. The internal HTTP client validates each redirect and never automatically redirects a mutation. Browser DNS aliases do not resolve freely. API credentials and AI secrets are omitted from worker environments.

These controls do not provide OS-level total browser RSS/CPU quotas or a complete hostile-browser network sandbox. Chromium still executes the owned application's scripts. Browser-generated background/transport traffic is outside the application-request counter. Use disposable owned development applications; arbitrary adversarial websites are unsupported. Traces are capped when finalized, so transient trace storage can exceed the persisted-artifact cap. Historical data is retained until the local owner removes it; there is no automatic retention/quota policy for total accumulated history yet.

## Artifact privacy

Metadata excludes authorization/cookie headers and response bodies by default. Common credential keys, Bearer tokens, JWT patterns and sensitive URL parameters are redacted. Custom input values are omitted from public/exported run definitions. Screenshots mask password and one-time-code inputs. Arbitrary page text, unusual secret formats and raw Playwright traces cannot be reliably redacted. Screenshots/traces are marked sensitive and exposed only through authenticated local artifact endpoints. Never publish an unreviewed artifact directory.

The data directory contains the session token, original local scenario values, database and evidence. It is gitignored. Files request owner-only modes where supported; Windows inherits the containing user's ACL rather than providing POSIX mode guarantees. Treat the directory as private. The engine does not defend against a malicious process running as the same OS user.

## Cleanup and failure handling

Normal completion, cancellation, worker crash and timeout close owned listeners, browser processes and disposable databases. Tests include an uncooperative worker with a live browser and cancellation during actual queue load. Abrupt OS/API termination can leave disk remnants; startup deletes engine-owned disposable files and marks interrupted runs failed while preserving evidence/history. If both supervisor and worker are forcibly killed, no immediate application-level finalizer can run. Disk permission failures are reported as failures rather than silently claiming successful cleanup.
