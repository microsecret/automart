#!/usr/bin/env bash
# Read-only production smoke and access-control audit.
# Run only on the application server:
#   bash scripts/server-smoke-audit.sh http://127.0.0.1:4000
set -u

base_url="${1:-http://127.0.0.1:4000}"
passed=0
failed=0

probe() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected="$4"
  shift 4

  local code
  code="$(curl -sS -o /tmp/automart-smoke-response -w '%{http_code}' -X "$method" "$base_url$path" "$@" || true)"
  if [[ "|$expected|" == *"|$code|"* ]]; then
    printf 'PASS %-48s %s\n' "$name" "$code"
    passed=$((passed + 1))
  else
    printf 'FAIL %-48s expected=%s actual=%s\n' "$name" "$expected" "$code"
    failed=$((failed + 1))
  fi
}

# Public pages and APIs: no mutations.
probe 'home page' GET '/' 200
probe 'news page' GET '/news' 200
probe 'auctions page' GET '/auctions' 200
probe 'services hub' GET '/services' 200
probe 'fuel map page' GET '/services/fuel-map' 200
probe 'history page' GET '/services/history-check' 200
probe 'valuation page' GET '/services/valuation' 200
probe 'smart matching page' GET '/services/smart-matching' 200
probe 'safe-deal page' GET '/services/safe-deal' 200
probe 'legal documents page' GET '/services/legal-documents' 200
probe 'parts finder page' GET '/parts-finder' 200
probe 'help page' GET '/help' 200
probe 'privacy page' GET '/legal/privacy' 200
probe 'news API' GET '/api/news?limit=3' 200
probe 'auctions API' GET '/api/auctions?limit=2' 200
probe 'exchange-rate API' GET '/api/exchange-rates' 200
probe 'fuel-stations API' GET '/api/fuel-stations?city=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0' 200

# Boundary checks: invalid or unauthorized requests must not be accepted.
probe 'auction validation' GET '/api/auctions?country=INVALID' 400
probe 'news import without token' POST '/api/news/import' 401 -H 'Content-Type: application/json' --data '{}'
probe 'parser import without token' POST '/api/parser/auctions' 401 -H 'Content-Type: application/json' --data '{}'
probe 'Encar parser without token' POST '/api/parser/encar' 401 -H 'Content-Type: application/json' --data '{}'
probe 'admin stats without session' GET '/api/admin/stats' '401|403'
probe 'delivery orders without session' GET '/api/delivery-orders' 401
probe 'delivery order detail without session' GET '/api/delivery-orders/not-a-real-order' 401
probe 'upload without session' POST '/api/upload' 401
probe 'AI valuation without session' POST '/api/ai/valuation' 401 -H 'Content-Type: application/json' --data '{}'
probe 'AI smart matching without session' POST '/api/ai/smart-matching' 401 -H 'Content-Type: application/json' --data '{}'
probe 'AI history check without session' POST '/api/ai/history-check' 401 -H 'Content-Type: application/json' --data '{}'
probe 'AI price prediction without session' POST '/api/ai/price-prediction' 401 -H 'Content-Type: application/json' --data '{}'
probe 'AI damage assessment without session' POST '/api/ai/damage-assessment' 401 -H 'Content-Type: application/json' --data '{}'
probe 'payment intent without session' POST '/api/payment/create-intent' 401 -H 'Content-Type: application/json' --data '{}'
probe 'payment webhook unsigned' POST '/api/payment/webhook' '400|503' -H 'Content-Type: application/json' --data '{}'
probe 'Telegram webhook without secret' POST '/api/telegram/webhook' '401|503' -H 'Content-Type: application/json' --data '{}'
probe 'invalid registration rejected or rate-limited' POST '/api/auth/register' '400|429' -H 'Content-Type: application/json' --data '{"email":"not-an-email","password":"x","name":""}'

headers="$(curl -sSI "$base_url/api/news?limit=1" || true)"
for header in 'x-content-type-options: nosniff' 'x-frame-options: deny' 'content-security-policy:'; do
  if grep -qi "^$header" <<< "$headers"; then
    printf 'PASS security header: %s\n' "$header"
    passed=$((passed + 1))
  else
    printf 'FAIL security header: %s\n' "$header"
    failed=$((failed + 1))
  fi
done

printf 'SUMMARY pass=%s fail=%s\n' "$passed" "$failed"
[[ "$failed" -eq 0 ]]
