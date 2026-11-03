# Community invitations and authorization notices

Requested persistent community invitations use the existing polling marketing
worker and TelegramChat.lastPromoAt atomic claim, with a six-hour minimum.
Only active marketing-enabled chats are eligible. The live getChat response
must identify the destination and provide its public username or existing
Telegram invite link; no invitation is created or exported. The share button
opens Telegram sharing for that particular chat. Community posts do not enter
the five-minute system-message cleanup queue.

Temporary moderation notices now say “авторизация” and offer “Пройти
авторизацию” and “Рассказать другу”. The underlying account requirements are
unchanged. Notices continue to expire after five minutes. Private chats without
a public username share the bot link rather than inventing a group invite.

Built-in imagegen generated two original 1536×1024 images, not native 8K.
Prompts: bright daylight photorealistic LeWheel teal/copper car showroom,
smartphone identity/checkmark, heading “Авторизация в LeWheel”; and a sunny
automotive plaza with three adult enthusiasts, connected-people phone artwork,
heading “Пригласите друзей в наш чат”. Both carry t.me/lewheelbot attribution.
Local sources: D:/Проекты/Авторынок/output/authorization-20261103.png and
community-invite-20261103.png. Server quality90 JPEG derivatives live under
public/uploads; TELEGRAM_MODERATION_IMAGE and COMMUNITY_INVITE_IMAGE select
them. Old artwork is retained.

Exact Android/iOS native-menu tutorial artwork is awaiting the user's phone
screenshots. Inline buttons cannot invoke Telegram's native add-member menu;
the current post provides manual guidance and a share invitation instead.
