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
- Payment audit found additional work: paid parts are skipped by the current
  chat worker; concurrent renewal reads outside the transaction can lose paid
  duration; chat activation can overwrite visual Premium/VIP benefits; repeat
  posts must not be labelled as distinct chat reach. These need isolated
  payment/delivery regression tests and their own reviewed fix.
- Operational: production root filesystem was 92% used with 6 GB available;
  old deployment archives need a deliberate retention policy. Current media,
  database and backups were not deleted by this audit.

Next priorities are verified-email onboarding, durable message notification
delivery, accurate paid promotion scheduling/metrics and the remaining
authenticated/mobile/role matrices. Existing paid conditions must survive
any tariff migration unchanged.
