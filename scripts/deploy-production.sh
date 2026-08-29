#!/usr/bin/env bash
set -euo pipefail

# The collector script and this deployment both touch the running parser
# surface. Holding the same lock prevents cron from calling routes that exist
# on disk but are not served by the previous process yet.
if command -v flock >/dev/null 2>&1; then
  exec 9>/tmp/automart-encar-collector.lock
  # A complete serialized source pass can legitimately take about half an hour
  # when several upstreams reach their bounded request timeout. Ten minutes
  # caused a healthy release to fail before the collector had finished.
  DEPLOY_LOCK_WAIT_SECONDS="${AUTOMART_DEPLOY_LOCK_WAIT_SECONDS:-3600}"
  if ! [[ "$DEPLOY_LOCK_WAIT_SECONDS" =~ ^[1-9][0-9]*$ ]] || (( 10#$DEPLOY_LOCK_WAIT_SECONDS > 3600 )); then
    echo "AUTOMART_DEPLOY_LOCK_WAIT_SECONDS must be an integer from 1 to 3600" >&2
    exit 1
  fi
  if ! flock -w "$DEPLOY_LOCK_WAIT_SECONDS" 9; then
    echo "Timed out waiting for the auction collector lock after ${DEPLOY_LOCK_WAIT_SECONDS}s" >&2
    exit 1
  fi
fi

# Run on the production host from the repository root. Secrets stay in the
# server environment; this script deliberately never writes them to the repo.
git pull --ff-only origin master
if ! migration_output="$(npx prisma migrate deploy 2>&1)"; then
  printf '%s\n' "$migration_output" >&2

  # The first production database predates migration tracking and already has
  # every object from this reconcile migration. Prisma records the attempted
  # duplicate ADD COLUMN as failed. Resolve only this known case and only when
  # the live schema is proven identical to the current data model.
  if [[ "$migration_output" == *"20260816013000_reconcile_clean_schema"* ]] \
    && npx prisma migrate diff \
      --from-schema-datasource prisma/schema.prisma \
      --to-schema-datamodel prisma/schema.prisma \
      --exit-code; then
    npx prisma migrate resolve --applied 20260816013000_reconcile_clean_schema
    npx prisma migrate deploy
  else
    exit 1
  fi
else
  printf '%s\n' "$migration_output"
fi
# The project has legacy schema fields created before migration tracking.
# This safe sync only adds missing fields; it never accepts destructive changes.
npx prisma db push --skip-generate
npx prisma generate
# A fresh database must not wait for the morning cron before import prices can
# be calculated. The step still fails the deployment when no usable rate exists,
# but a CBR outage no longer blocks a release while the stored snapshot is less
# than a day old: those prices are still accurate.
node scripts/refresh-auction-rates.mjs
node scripts/enforce-encar-import-age-policy.mjs
node scripts/reconcile-transport-categories.mjs
# Older lots are repaired using the same strict explicit-badge rule as new
# imports. The operation is idempotent and never overwrites a source value.
node scripts/backfill-auction-explicit-drive-types.mjs --apply
# Аудит целостности сообщает о расхождениях в данных, но не решает судьбу
# выпуска: объявление продавца без VIN — повод для модерации, а не причина
# оставить сервер на старой сборке. Отчёт остаётся в логе целиком.
node scripts/audit-listing-integrity.mjs || echo "Warning: listing integrity audit reported findings; see the report above"
if command -v crontab >/dev/null 2>&1; then
  bash scripts/install-auction-rate-cron.sh || echo "Warning: auction-rate cron was not installed"
  bash scripts/install-encar-collector-cron.sh || echo "Warning: Encar collector cron was not installed"
  # Инсталлятор получает только разрешающий флаг. Раньше deploy не загружал
  # .env вообще, принимал значение по умолчанию `off` и удалял уже включённое
  # расписание при каждом релизе.
  auction_telegram_cron_flag="$(node --env-file=.env -p 'process.env.AUTOMART_AUCTION_TELEGRAM_CRON || "off"')"
  AUTOMART_AUCTION_TELEGRAM_CRON="$auction_telegram_cron_flag" \
    bash scripts/install-auction-telegram-cron.sh || echo "Warning: auction Telegram cron was not installed"
  bash scripts/install-partner-sla-cron.sh || echo "Warning: partner SLA cron was not installed"
  bash scripts/install-analytics-prune-cron.sh || echo "Warning: analytics prune cron was not installed"
  bash scripts/install-listing-backfill-cron.sh || echo "Warning: listing backfill cron was not installed"
  bash scripts/install-fuel-invite-cron.sh || echo "Warning: fuel invite cron was not installed"
  bash scripts/install-fuel-digest-cron.sh || echo "Warning: fuel digest cron was not installed"
  bash scripts/install-message-attachment-prune-cron.sh || echo "Warning: message attachment prune cron was not installed"
fi
npm run type-check
npm run build
bash scripts/install-production-network.sh
# The strict form/API gate protects new submissions. This post-start step uses
# the exact same compiled validator to return older incomplete public cards to
# their owners for correction without deleting their data.
bash scripts/enforce-legacy-listing-readiness.sh
if systemctl list-unit-files automart-telegram.service --no-legend 2>/dev/null | grep -q '^automart-telegram\.service'; then
  systemctl restart automart-telegram
  systemctl is-active --quiet automart-telegram
fi
