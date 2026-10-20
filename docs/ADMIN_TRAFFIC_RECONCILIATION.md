# Administrator traffic reconciliation

## Contract

- The detailed report and main summary use `trafficVisitorIdentity`: IP hash,
  then legacy browser key, then legacy session key. This is the existing product
  metric, not a claim that one shared IP always represents one human.
- A product group's unique visitors are the union of its section identities.
  Adding section counts double-counts people who browse several sections.
- Every selected VisitEvent contributes one page view to paths, sections,
  groups, days and hours. Missing identity never creates a visitor and never
  discards a page view.
- Bounce rate is the percentage of identified sessions with exactly one view.
  Legacy events without a session key are excluded from that denominator.
- Current-period traffic cannot include future-dated events. Calendar periods
  remain Moscow-based for compatibility; this change does not reinterpret
  account registration timestamps or migrate stored events.

## Verification

Run only on the server after a production build:

```sh
AUTOMART_AUTH_AUDIT_SCRIPT=scripts/verify-admin-traffic.mjs bash scripts/run-server-authenticated-audit.sh
```

The runner creates a disposable SQLite database and a separate loopback server.
The test inserts fixed browser/IP/session combinations, legacy unidentified
views and a future event. Assertions use authenticated HTTP responses, including
access denial for guests and ordinary users, cross-report consistency, session
bounce rate and absence of raw identity values in responses.

The first regression run against the old build reproduced nine inconsistencies.
The original test was then strengthened to include three browser keys sharing
one IP hash, avoiding a coincidental equality in the total visitor count.

## Limits

The existing 50,000-event per-period selection remains. These repairs make
aggregation consistent within that selection; exact high-volume reporting
beyond the cap still needs a separate database aggregation/rollup design.
No migration, dependency, cron change or production event rewrite is required.
Kluster integration was unavailable during implementation; no Kluster result
is claimed. Server type checks, lint, isolated API tests and smoke checks are
the release gates.
