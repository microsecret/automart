#!/usr/bin/env bash
set -euo pipefail

# The collector script and this deployment both touch the running parser
# surface. Holding the same lock prevents cron from calling routes that exist
# on disk but are not served by the previous process yet.
if command -v flock >/dev/null 2>&1; then
  exec 9>/tmp/automart-encar-collector.lock
  DEPLOY_LOCK_WAIT_SECONDS="${AUTOMART_DEPLOY_LOCK_WAIT_SECONDS:-600}"
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
# be calculated. Fail the deployment if the official CBR snapshot cannot be
# loaded: silently using guessed or missing rates would make landed-cost totals
# misleading.
node scripts/refresh-auction-rates.mjs
node scripts/enforce-encar-import-age-policy.mjs
node scripts/reconcile-transport-categories.mjs
node scripts/audit-listing-integrity.mjs
if command -v crontab >/dev/null 2>&1; then
  bash scripts/install-auction-rate-cron.sh || echo "Warning: auction-rate cron was not installed"
  bash scripts/install-encar-collector-cron.sh || echo "Warning: Encar collector cron was not installed"
fi
npm run type-check
npm run build
bash scripts/install-production-network.sh
