# Production audit and fixes — 3 November 2026

The user requested parallel functional, security and UX audits, verified fixes,
screenshots and production deployment. During the audit the user explicitly
authorized a live branded Telegram campaign: unfinished registrations first,
registered sellers second, at most five messages per second in total.

Three agents independently reviewed authentication/security, notifications,
and frontend workflows. Root reviewed the findings and implemented/reviewed
fixes. Kluster tools were unavailable; no Kluster verification is claimed.

## Confirmed fixes

- P1: resetting a password deleted database sessions while actual sessions
  were JWTs. User.sessionVersion now changes atomically with reset/token
  consumption. Credentials and their version are captured together; refresh
  cannot upgrade an old JWT. Existing versionless tokens represent zero and
  remain compatible until that account resets its password.
- P1: truthy but invalidated sessions could reveal seller phones and reach
  public uploads. These endpoints and favorites now use requireUser.
- P2: Mini App messages stopped at 30 conversations. Server-backed search and
  pagination now cover the complete participant-scoped mailbox.
- P2: Mini App messages did not refresh and treated server/network errors as
  a registration problem. Visible-tab polling, retry, separate 401/403 copy
  and attachment-only previews address those cases.
- P2: creation buttons lost their URL start intent or reached protected pages
  before Telegram authentication. The public Mini App shell now consumes
  whitelisted create/createpart/payments/dashboard intents after login.
- P2: automatic entry destinations could trap Back in a redirect loop.
  Replacement navigation and explicit root-back behavior consume the intent.
- Promotion shortcuts use existing approved wallet/scenic artwork. Seller
  messages offer Mini App creation, website creation and Mini App tariffs.

## Live campaign safeguards

Preview initially found 1924 reachable contacts: 1405 incomplete registrations
and 519 registered sellers. Eligibility is checked again before each send;
blocked, opted-out and restricted users are excluded. Counts can change.

The completed wave `20261103-branded-invite` checked 1925 contacts and delivered
1834 messages: 1335 registration reminders and 499 seller invitations. Telegram
reported 91 contacts blocked/unavailable; uncertain results, rate-limit errors
and failed state updates were all zero. All three lifecycle scheduler jobs were
restored and the active marker cleared. An aggregate completed-wave entry was
saved in the administrator broadcast history without exposing recipient IDs.

The explicit campaign is separate from the normal weekly schedule. A private
atomic/fsynced checkpoint is recorded before each provider call. A lost reply
is not proof of failure and is never automatically resent. Definite Telegram
retry-after responses may be retried after waiting; the first unexpected
failure stops the wave. A successful first upload caches Telegram file_id.

The wave checks bot identity and exact scheduler tags before applying. A
private active marker stops periodic lifecycle workers before claims/sends;
unsent claimed attempts are released. Future lifecycle cron jobs are paused,
existing sends drain, then registration and seller phases run sequentially.
Cleanup restores only this wave's tagged cron lines and removes only its own
marker. A crash needs explicit resume/repair; locks do not silently expire.
No credentials or recipient identifiers appear in public progress logs.

## Verification evidence

Server-only checks use disposable databases; real email credentials are blank
and Telegram authentication uses the dummy audit-only-token. Browser external
traffic is blocked. Test runs do not send campaign messages.

- Broad authenticated API baseline: 250 checks passed on an isolated DB.
- Reset/revocation integration: 25 checks passed, including real credentials
  login, one-time token reuse, legacy/current JWT revocation and invalid
  account access to contact/upload endpoints.
- Initial Mini App browser matrix: 42 checks passed across desktop/mobile,
  mailbox search/pagination/errors/polling and fresh-cookie deep links.
- Pure route/message/schedule tests: 28 passed.
- Campaign CLI argument/cron/checkpoint tests: three passed.
- Final coordination/CLI tests: 22 passed. Final Mini App browser confirmation:
  44 passed, including Back from both signed and URL payment entry intents.
  TypeScript, scoped ESLint and production build passed on the server.

Screenshots and the initial browser report are saved under
`D:/Проекты/Авторынок/output/production-audit-20261103`.

## Paid promotion follow-up

- A first transaction write now serializes renewal expiry reads. Distinct
  simultaneous payments add their full durations; duplicate callbacks do not
  activate twice. Inactive/deleted/transferred listings retain the payment
  reference for manual review instead of receiving a false active entitlement.
- Legacy chat orders retain their stored price/duration and 48-hour cadence.
  Their expiry is independent of the listing's website Premium/VIP fields.
- Paid parts use their actual part URL, OEM/compatibility/condition data and
  creation action. Unsupported subjects cannot consume the bounded batch.
- Repost cooldowns are keyed by listing and chat across renewals. Renewed
  listings retain earlier posts during expiry cleanup; expiry warnings use
  the latest paid entitlement rather than an obsolete predecessor order.
- Dashboard history separates repeat publications from distinct destinations,
  omits raw chat IDs and scopes every aggregate to the current owner. Active
  placements count each active listing once; superseded website orders cannot
  revive an expired placement. Revoked sessions receive 401.
- Ordinary administrator broadcasts now retain the user's five-per-second
  limit in addition to the completed explicitly requested campaign.

Server verification: activation integration 24 checks, delivery/expiry and
broadcast timing tests 11, post formatting tests 20; all passed. An independent
final static review found no remaining material blocker in this scoped delta.
The final disposable dashboard API/browser matrix passed 26 checks, including
superseded Premium/expired Boost, anonymous/revoked sessions, owner privacy,
distinct destinations and mobile/desktop overflow/runtime checks. Final
TypeScript, scoped ESLint and production build passed. Screenshots are
`promotion-metrics-mobile.png` and `promotion-metrics-desktop.png` in the same
local audit output directory. The fixture values are synthetic, not live sales.

## Open findings and practical limits

This is evidence for the checked flows, not a claim that every site feature
or every external provider scenario has passed an exhaustive audit.

- P1 / email rollout blocker: Telegram registration currently sets
  emailVerified after password entry without proving mailbox ownership.
  Private conversation emails must require a genuine mailbox challenge,
  including a policy for legacy Telegram accounts. Production also lacks
  configured email-provider/sender credentials.
- P2: message-notify infers prior delivery from another recent message;
  concurrent first messages or a failed first send can suppress notifications.
  A durable delivery/attempt ledger is still needed.
- P2: general Telegram JSON transport may retry ambiguous writes. Restrict
  retries by operation semantics; the branded photo campaign does not use
  that retrying path.
- P2: additional legacy API routes still check truthy sessions rather than
  valid identities. Reviewed owner predicates avoid disclosure, but some
  invalid sessions receive empty data or server errors; migrate consistently.
- P2: Mini App menu drawer lacks a complete keyboard focus trap.
- Approved new chat plans (300/7 days daily, 700/30 days daily, 1200/30 days
  twice daily) and full nine-photo posts remain separate unfinished work.
  Current seller campaign advertises no new prices or invented reach numbers.
- The payment follow-up fixes paid part delivery, serialized renewal activation,
  independent chat entitlements and distinct chat/publication metrics. Its
  verification evidence is recorded separately below.
- Operational cleanup removed 24 explicitly verified historical compiled-build
  archives older than 30 October (18,505,298,030 file bytes). Free space rose
  from about 6 GB to 23 GB (92% to 70% used). Current/previous builds, recent
  rollback archives, source, media, databases and backups were preserved.

Next priorities are verified-email onboarding, durable message notification
delivery, accurate paid promotion scheduling/metrics and the remaining
authenticated/mobile/role matrices. Existing paid conditions must survive
any tariff migration unchanged.
