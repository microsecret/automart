# Saved search delivery — 20 October 2026

- `SavedSearchDelivery` is a durable per-user rolling 24-hour quota ledger.
  At most five new match intervals are reserved per account. It is independent
  of visible notifications and saved-search deletion, so deletion/restart cannot
  reset the budget. Only account deletion cascades into its ledger.
- A transaction claims the unchanged subscription checkpoint, writes the ledger
  and creates the site notification. It has no external HTTP side effects.
- Telegram follows the transaction. A failure leaves the site notification
  available. The worker does not replay an ambiguous send; Telegram transport
  retries themselves still cannot provide exactly-once external delivery.
- Users without Telegram, and known blocked bot contacts, receive site-only
  notifications. Banned accounts are excluded.
- `lastCheckedAt` rotates the bounded queue separately from `lastNotifiedAt`.
  Quota deferral must preserve the matching watermark. Empty matches advance
  both, preventing the same empty searches from starving the rest of the batch.
- Counts use exact lower timestamps and a fixed upper run boundary. Auction
  matches reuse public visibility/freshness/age policy. Parts include the same
  bounded store-publication window. Legacy EU links resolve to DE.
- The two-minute run budget stops before starting another subscription; it is
  not an abort deadline for an already-running database or Telegram request.

Migration is additive (one nullable field, one table and indexes). Take an online
SQLite backup before applying it. A code rollback leaves the added structures
intact; do not drop the ledger or restore a database automatically.

Verification: `verify-saved-search-notifications.mjs` runs through the protected
worker API against a disposable database. The runner explicitly disables the
Telegram token. HTML message escaping has independent unit coverage. Existing
subscription UI is unchanged in this backend increment.
