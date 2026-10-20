# Third-party bot admission policy

## Current rule (owner clarification, 20 October 2026)

Only bots with a live administrator role in the group may remain. The
inviter's role grants no exception, including anonymous administrators.
Historical `TelegramBotApproval` rows never authorize a bot and no new approvals
are written. The table remains for compatibility, not as an active allowlist.
Role changes, including demotion, are re-checked against live Telegram state.
Anonymous human administrator speech on behalf of the group is not a bot account.

Only configured moderated groups (`TELEGRAM_MODERATION_ENABLED` and the existing
chat allowlist) are affected. The moderator must be a group administrator with
`can_restrict_members`; service-message cleanup also needs `can_delete_messages`.
Missing rights warn in the server log, never report a successful removal.

The polling bridge now explicitly requests `chat_member` alongside messages and
callbacks. Both the service message's new members and membership join events
reach the same tested guard before registration moderation. Normal human
members are never banned by this policy; the person who invited a bot is not
punished. The moderator itself and target bots with an administrator role are
always protected. Live Telegram role lookups, not names/usernames, determine
the exception. A failed role lookup never authorizes a destructive action.

Any detected non-administrator bot is banned with `revoke_messages: true` and
is not automatically unbanned afterwards. Telegram revokes the removed bot's
messages in supergroups. Historical approval rows are cleared on leave/kick
events and successful removal, but never exempt a bot. A group administrator
must grant the bot an administrator role if it is to remain.

## Platform limits

Bot API normally does not deliver other bots' messages to a bot, even with
privacy mode disabled. Admission events are therefore the primary defense;
message-time protection applies only when Telegram actually delivers a bot
message. It cannot promise interception of every bot/guest-bot message or
enumerate all existing chat members for retrospective cleanup. Existing
administrator bots are not mass-removed, and there is no MTProto/userbot login.

Webhook handling retains the application's existing asynchronous processing:
successful receipt is not a durable job acknowledgment. A process crash can
lose an in-flight event. Previously existing non-admin bots are checked when
an observable message or membership event about them is received. Membership
events are processed as received; a future durable ordered event queue would
be a separate reliability increment.

## Verification and rollout

### Batch reliability

A failed target lookup or ban no longer aborts the remaining bots in the same
update. Each target's live administrator role is still checked independently;
an unknown role never authorizes removal. Moderator capability is requested
once per event, including sharing a failure without amplifying requests, and
is fetched afresh in the next event. Duplicate bot IDs are deduplicated only
inside that event, not across future role changes.

The shared service message is deleted at most once successfully. A historical
approval-table cleanup failure warns but does not prevent deleting the message
after a successful ban. Error logging uses fixed diagnostics without Telegram
response bodies or tokens. This remains best-effort event processing, not a
durable retry queue: a failed bot may wait for another event.

The original server test reproduced five failing batch/error-path checks before
the fix. Additional tests verify denial on unknown moderator capability and a
fresh capability lookup in the next event. All tests use injected transport;
no real group member is removed by the test suite.

`node --test tests/telegram-bot-guard.test.mjs` runs on the server with injected
Telegram transport and approval storage. It never bans a real bot during tests.
The additive migration creates only the approval table. Take an online SQLite
backup before applying it, generate Prisma, build on the server and restart
both `automart` and `automart-telegram`. Keep the polling offset file intact.
Do not start another getUpdates consumer or drop pending updates.

Official references: https://core.telegram.org/bots/faq and
https://core.telegram.org/bots/api#chatmemberupdated .
Kluster is unavailable in the current tool inventory and was not run.
