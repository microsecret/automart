# Auction read optimisation — 19 October 2026

## Scope and acceptance

- Coalesce concurrent identical public page reads; never retain completed page
  results, so later requests reapply current visibility and moderation policy.
- Coalesce analytics cache misses across pages of the same filter. Keep the
  existing five-minute analytics TTL and 64-entry limit; cache success only.
- Preserve brief/card/full response contracts, filter isolation and pagination.
- Bound pending bookkeeping too. At capacity, unrelated reads run uncached;
  this mechanism is not a concurrency limiter or distributed rate limiter.
- No schema changes, production record updates, new packages or local builds.

## Evidence and verification

Before the change, a bounded six-request burst against one cold JP filter
returned three HTTP 500 responses, with SQLite P1008 timeouts in the service
journal; the group finished in 6901 ms. This is one production observation,
not a general benchmark or proof that all SQLite contention shares this cause.

`tests/async-read-cache.test.mjs` covers shared pending work, fresh page reads,
TTL boundaries, failure recovery, LRU eviction, capacity pressure and null data.
`scripts/verify-auction-read-concurrency.mjs` checks cold/warm bursts and isolated
pagination/brief responses on the server. Its JSON report is the release evidence.

The process-local optimisation does not solve competing writes from collectors,
contention between different filters, multi-process coordination or horizontal
scaling. Redis/KeyDB rate limiting and broader database tuning remain open.

## Skill routing

The project graph sets the scope; ECC backend-patterns guides duplicate-work
removal and bounded caching. Spec Kit's acceptance-first/task-by-story approach
is used here without initialising another project framework. Existing visual
assets and styles are unchanged in this backend increment. UI tutorials and
motion remain a separate frontend increment, not an unverified release claim.
