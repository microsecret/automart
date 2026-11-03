# Telegram weekly campaign photos

The user requested weekly registration reminders until completion, a separate
seller invitation for registered users, and visible bot attribution on the
images themselves. This release implements that lifecycle slice. No paid
tariff, checkout, paid repost frequency or private message email change is
included here. Approved next plans remain 300 RUB / 7 days daily, 700 RUB /
30 days daily, 1200 RUB / 30 days twice daily; preserve existing orders.

All three existing scheduler URLs call the same worker. Each contact who has
started the bot is eligible after seven days; both campaign timestamps and the
old User.regReminderAt are respected. Conditional updateMany claims prevent
concurrent endpoints from duplicating sends. The claim consumes an attempt
before sending: ambiguous transport failures are not retried immediately.
An explicit Telegram retry-after rejection releases that contact's claim and
stops the batch; unprocessed contacts remain due for the next scheduler run.
Both successfully delivered photo types update lastWeeklyAt; the admin count
is a bounded next-batch count, not an alleged total of today's recipients.
Contacts are ordered by last broadcast so older contacts no longer retire from
the queue and starve newer ones. The live User registration fields choose the
message; a stale TelegramContact.registered flag does not decide it.

Opt-outs, blocked chats and restricted site accounts are excluded. Completion
stops registration reminders and switches to the seller invitation at the next
weekly due time. Explicit admin preview remains outside the automatic clock.
Private seller/registration messages are not temporary group campaigns and
are not enrolled in the five-minute service-message cleanup queue.

## Artwork provenance

Generated and edited with the built-in imagegen tool, not the CLI. Two masters
are saved in `D:/Проекты/Авторынок/output/telegram-campaign-20261103`:
registration-master.png and seller-master.png. Native size is 1536x1024, not
native 8K. Server Sharp converts them to JPEG quality 88 without resizing;
the runtime uploads bytes to Telegram rather than relying on URL fetching.

Registration final prompt: edit the sunny showroom, petrol teal sedan,
marble phone and key; remove manufacturer badge; premium petrol/copper text
panel with exact text “LeWheel”, “Завершите регистрацию”, “Ваш авторынок — в
Telegram”, “t.me/lewheelbot”; repeated discreet diagonal “LeWheel ·
t.me/lewheelbot” watermark. Preserve landscape composition, no QR/fake controls.

Seller final prompt: preserve sunny forecourt, petrol teal vehicle, wheel,
turbo and copper toolkit; premium petrol/copper panel with exact text
“LeWheel”, “Продавайте авто и запчасти”, “Разместите объявление в Telegram”,
“t.me/lewheelbot”; repeated diagonal “LeWheel · t.me/lewheelbot” watermark.
The link printed in a raster is attribution; actual clickable links are in
Telegram inline buttons. Watermarks discourage reuse but cannot prevent it.

No invented reach figures, guarantee of sale, prices or chat counts appear
on these reusable weekly images. Pricing artwork will accompany the reviewed
tariff implementation rather than advertising plans not yet available.

## Review and validation

Two independent read-only reviews covered specification and repository
standards. Findings fixed: flood-limit attempts, stale admin campaign copy,
mislabelled batch count and missing registration deliveries in weekly stats.
Neither reviewer reported remaining material issues after the fixes.

Server checks: 23 worker/admission tests and 21 schedule/message tests passed;
TypeScript and scoped ESLint passed. No marketing messages were sent as tests.
The JPEGs retain 1536x1024 pixels and total 811704 bytes. Kluster tools were
unavailable; this report does not claim a Kluster verification.
