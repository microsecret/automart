# Telegram cleanup and reduced campaign frequency

User request: delete the bot's temporary chat messages after five minutes,
recheck failed deletions, and reduce auction and fuel-map spam.

Incident: the ten-second cleanup timer was running but the local route returned
500. The Next process held a SQLite writer lock and its queries failed with a
connector error. Restarting that process restored catalogue/database checks;
SQLite quick_check then returned ok. This identifies the operational blockage,
not the original transaction that caused it.

The durable queue now leases a due record with an optimistic conditional
update. A crashed attempt becomes eligible again after five minutes, including
the old fifth-attempt edge case. Network and permission failures remain pending
with bounded backoff, rather than disappearing after five tries. Already absent
messages complete successfully. Expired records stop at Telegram's 48-hour
deletion boundary. A lease is bounded and deletion is idempotent; no exactly-once
network guarantee is claimed.

Auction highlights and both fuel invitation/digest branches register returned
message IDs for five-minute cleanup. Existing temporary moderation and marketing
messages retain their queue registration. Private subscriber notifications and
user-created listing publications are outside this campaign change.

Automatic auction runs select one lot and respect a 24-hour per-chat history
gate; the cron changes from every eight hours to daily. Explicit operator CLI
overrides remain possible. Fuel invitations and fuel digests consult both post
histories with a minimum common interval of 72 hours. Their existing cron locks
and route admission remain; these read gates are not distributed atomic claims.

Reconciliation defaults to preview. --apply queues only IDs recorded in the
three campaign tables during the last 48 hours, only in group/channel chats,
and reopens recent failed cleanup except messages already reported absent.
It neither guesses message IDs nor sends test messages or reads chat history.
No schema migration or dependency addition is needed.

Regression checks exercise due times, retry beyond attempt five, permission
recovery, lost claims, stale attempts, expiry, and the shared fuel history gate.
Tests/build run only on the server; review before push/deploy. Kluster is not
available in this session and is not claimed as verification.
