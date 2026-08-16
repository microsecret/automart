#!/usr/bin/env bash
set -euo pipefail

# Run on the production host from the repository root. Secrets stay in the
# server environment; this script deliberately never writes them to the repo.
git pull --ff-only origin master
npx prisma migrate deploy
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
