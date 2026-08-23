#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

audit_port="${AUTOMART_AUTH_AUDIT_PORT:-4011}"
if ! [[ "$audit_port" =~ ^[0-9]+$ ]] || (( 10#$audit_port < 1024 || 10#$audit_port > 65535 )); then
  echo "AUTOMART_AUTH_AUDIT_PORT must be an integer from 1024 to 65535" >&2
  exit 1
fi
if command -v ss >/dev/null 2>&1 && ss -H -ltn "sport = :${audit_port}" | grep -q .; then
  echo "Port ${audit_port} is already in use" >&2
  exit 1
fi
if [[ ! -s .env || ! -x node_modules/.bin/prisma || ! -f .next/BUILD_ID ]]; then
  echo "Run this audit after a successful production build from the project root" >&2
  exit 1
fi

audit_directory="$(mktemp -d /tmp/automart-auth-audit.XXXXXX)"
audit_directory="$(realpath "$audit_directory")"
if [[ "$audit_directory" != /tmp/automart-auth-audit.* ]]; then
  echo "Refusing to use an unexpected audit directory: ${audit_directory}" >&2
  exit 1
fi
audit_database="${audit_directory}/automart-audit.db"
audit_documents="${audit_directory}/documents"
server_log="${audit_directory}/server.log"
server_pid=""

cleanup() {
  if [[ -n "$server_pid" ]] && kill -0 "$server_pid" 2>/dev/null; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  if [[ -d "$audit_directory" && "$audit_directory" == /tmp/automart-auth-audit.* ]]; then
    rm -rf -- "$audit_directory"
  fi
}
trap cleanup EXIT INT TERM

database_url="file:${audit_database}"
base_url="http://127.0.0.1:${audit_port}"

env DATABASE_URL="$database_url" npx prisma migrate deploy
env DATABASE_URL="$database_url" node --env-file=.env scripts/refresh-auction-rates.mjs

env \
  DATABASE_URL="$database_url" \
  DELIVERY_DOCUMENTS_PATH="$audit_documents" \
  NEXTAUTH_URL="$base_url" \
  PORT="$audit_port" \
  node --env-file=.env node_modules/next/dist/bin/next start -p "$audit_port" >"$server_log" 2>&1 &
server_pid=$!

ready=false
for _ in $(seq 1 60); do
  if curl -fsS "${base_url}/auth/signin" >/dev/null 2>&1; then
    ready=true
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  echo "Isolated audit server did not become ready" >&2
  sed -n '1,160p' "$server_log" >&2
  exit 1
fi

env \
  AUDIT_BASE_URL="$base_url" \
  DATABASE_URL="$database_url" \
  DELIVERY_DOCUMENTS_PATH="$audit_documents" \
  NEXTAUTH_URL="$base_url" \
  node --env-file=.env scripts/server-authenticated-audit.mjs
