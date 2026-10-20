# Third-party bot admission policy

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

An ordinary member's unapproved bot is banned with `revoke_messages: true` and
is not automatically unbanned afterwards. Telegram revokes the removed bot's
messages in supergroups. A bot admitted by a verified chat administrator is
persisted in `TelegramBotApproval` for that chat only. Approval survives process
restarts but is cleared when a leave/kick membership event is received. A group
administrator can explicitly unban and re-add a previously banned bot.

## Platform limits

Bot API normally does not deliver other bots' messages to a bot, even with
privacy mode disabled. Admission events are therefore the primary defense;
message-time protection applies only when Telegram actually delivers a bot
message. It cannot promise interception of every bot/guest-bot message or
enumerate all existing chat members for retrospective cleanup. Existing
administrator bots are not mass-removed, and there is no MTProto/userbot login.

Webhook handling retains the application's existing asynchronous processing:
successful receipt is not a durable job acknowledgment. A process crash can
lose an in-flight event. Previously admin-approved bots whose admission was
never observed have no historical provenance in this new table. Membership
events are processed as received; a future durable ordered event queue would
be a separate reliability increment.

## Verification and rollout

`node --test tests/telegram-bot-guard.test.mjs` runs on the server with injected
Telegram transport and approval storage. It never bans a real bot during tests.
The additive migration creates only the approval table. Take an online SQLite
backup before applying it, generate Prisma, build on the server and restart
both `automart` and `automart-telegram`. Keep the polling offset file intact.
Do not start another getUpdates consumer or drop pending updates.

Official references: https://core.telegram.org/bots/faq and
https://core.telegram.org/bots/api#chatmemberupdated .
Kluster is unavailable in the current tool inventory and was not run.
