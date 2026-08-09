#!/usr/bin/env bash
set -euo pipefail

# Run on the production host from the repository root. Secrets stay in the
# server environment; this script deliberately never writes them to the repo.
git pull --ff-only origin master
npx prisma migrate deploy
npx prisma generate
npm run build
systemctl restart automart
systemctl is-active --quiet automart
