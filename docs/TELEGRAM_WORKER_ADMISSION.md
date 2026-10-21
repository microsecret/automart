# Scheduled Telegram worker admission

The common `createTelegramWorkerRoute` wrapper checks the configured secret
before admitting work. For each route instance, only one handler can run at a
time. A duplicate authorized request receives HTTP 409, code `WORKER_BUSY`,
`Retry-After: 15` and `Cache-Control: no-store`. It is not queued and must be
retried by its caller/scheduler. Different routes do not block one another.

The guard is released in `finally`, including handler and JSON serialization
failures. It deliberately has no expiry: an HTTP timeout does not cancel the
worker, so expiring admission could start a second copy over the first.

Scope: one route instance in one application process. This reduces redundant
DB access and overlapping side effects from repeated scheduler requests. It
does NOT serialize all database writes, coordinate multiple processes, persist
jobs, or guarantee exactly-once Telegram delivery. Domain delivery records and
the future durable/distributed queue remain necessary. Direct function calls
(outside these routes) are not covered. It is not claimed as the fix for the
unidentified transaction responsible for the 21 October database lock.

Server regression: `node --test tests/telegram-worker-route.test.mjs`.
The test uses real Next request/response classes and the real TS wrapper with
mock worker handlers. No database or Telegram network calls occur. Cases cover
ten simultaneous duplicates, later successful runs, handler failure, invalid
and missing secrets, independent routes and serialization failure.
