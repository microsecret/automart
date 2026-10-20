# Saved-search subscription controls

The account panel preserves the approved scenic banner and material palette.
Saved searches now expose readable filter previews, a pause switch, opening the
original results and confirmed deletion. A short optional tutorial explains
pause/resume and the existing five-notification rolling daily budget.

## API

`PATCH /api/saved-searches` accepts only `{ id, notifyTelegram: boolean }`.
The legacy field name controls saved-search delivery on both the site and bot;
it is not an independent Telegram-only preference. Ownership is checked inside
the transaction. Guests are rejected; another owner's ID returns 404. Invalid
types, unknown writable fields and overly long IDs are rejected.

Pausing keeps filters, title and the matching watermark. A false-to-true change
sets the watermark to now and clears old match/check display values, so users
are not flooded by matches accumulated during the pause. Repeated enable calls
are idempotent and never move that watermark again. Delivery ledger rows are
never reset by this endpoint. Already claimed/in-flight delivery cannot be
retracted by a subsequent pause.

## UI resilience

The existing Mantine switch retains keyboard and focus semantics. All mutations
share a synchronous guard against repeated clicks. Errors are visible and the
current state is retained for retry. Successful results update SWR without a
second request whose failure could misrepresent a successful write. Deletion
keeps its confirmation. No speculative optimistic success is shown.

The only authored motion is a 160ms opacity transition while updating a row,
using the existing ease-out token, disabled under reduced-motion preference.
Titles and conditions wrap on mobile. Dates use Asia/Yekaterinburg explicitly.
No new image assets, package dependencies, schema migration or bot broadcast
are needed for this workflow increment.

## Server-only verification

```sh
AUTOMART_AUTH_AUDIT_SCRIPT=scripts/verify-subscription-controls.mjs bash scripts/run-server-authenticated-audit.sh
```

The runner uses a disposable database and loopback server. Checks cover owner
isolation, strict validation, paused/resumed watermarks, retained delivery quota,
long labels, a simulated failed update, retry, keyboard operation and viewport
overflow. Desktop light and mobile dark screenshots are written under
`/tmp/lewheel-subscription-controls-20261020`. No test invokes the live notifier.

Kluster was unavailable in the tool inventory; it is not reported as passed.
