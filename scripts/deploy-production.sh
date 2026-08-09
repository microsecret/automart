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
node scripts/reconcile-transport-categories.mjs
npm run build
systemctl restart automart
systemctl is-active --quiet automart
