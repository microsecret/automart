#!/usr/bin/env bash
# Read-only production smoke and access-control audit.
# Run only on the application server:
#   bash scripts/server-smoke-audit.sh http://127.0.0.1:4000
set -u

base_url="${1:-http://127.0.0.1:4000}"
passed=0
failed=0
curl_options=()

# Lets a freshly delegated HTTPS hostname be audited against the local
# virtual host before every resolver's negative DNS cache has expired.
# Example: CURL_RESOLVE=lewheel.ru:443:127.0.0.1 bash scripts/server-smoke-audit.sh https://lewheel.ru
if [[ -n "${CURL_RESOLVE:-}" ]]; then
  curl_options+=(--resolve "$CURL_RESOLVE")
fi

probe() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected="$4"
  shift 4

  local code
  code="$(curl -sS "${curl_options[@]}" -o /tmp/automart-smoke-response -w '%{http_code}' -X "$method" "$base_url$path" "$@" || true)"
  if [[ "|$expected|" == *"|$code|"* ]]; then
    printf 'PASS %-48s %s\n' "$name" "$code"
    passed=$((passed + 1))
  else
    printf 'FAIL %-48s expected=%s actual=%s\n' "$name" "$expected" "$code"
    failed=$((failed + 1))
  fi
}

probe_body() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected="$4"
  local pattern="$5"
  shift 5

  local response_file
  response_file="$(mktemp)"
  local code
  code="$(curl -sS "${curl_options[@]}" -o "$response_file" -w '%{http_code}' -X "$method" "$base_url$path" "$@" || true)"
  if [[ "|$expected|" == *"|$code|"* ]] && grep -Eq "$pattern" "$response_file"; then
    printf 'PASS %-48s %s\n' "$name" "$code"
    passed=$((passed + 1))
  else
    printf 'FAIL %-48s expected=%s schema=%s actual=%s\n' "$name" "$expected" "$pattern" "$code"
    failed=$((failed + 1))
  fi
  rm -f "$response_file"
}

audit_home_assets() {
  local response_file
  response_file="$(mktemp)"
  local asset_urls
  if ! curl -sS "${curl_options[@]}" "$base_url/" -o "$response_file"; then
    printf 'FAIL %-48s unable to fetch home page\n' 'home page static assets'
    failed=$((failed + 1))
    rm -f "$response_file"
    return
  fi

  asset_urls="$(grep -Eo '(/_next/[^"'"'"' <>()]+\.(js|css))' "$response_file" | sort -u)"
  if [[ -z "$asset_urls" ]]; then
    printf 'FAIL %-48s no Next.js static assets found\n' 'home page static assets'
    failed=$((failed + 1))
    rm -f "$response_file"
    return
  fi

  local asset code
  while IFS= read -r asset; do
    [[ -z "$asset" ]] && continue
    code="$(curl -sS "${curl_options[@]}" -o /dev/null -w '%{http_code}' "$base_url$asset" || true)"
    if [[ "$code" != "200" ]]; then
      printf 'FAIL static asset %-36s actual=%s\n' "$asset" "$code"
      failed=$((failed + 1))
      rm -f "$response_file"
      return
    fi
  done <<< "$asset_urls"

  printf 'PASS %-48s %s assets\n' 'home page static assets' "$(wc -l <<< "$asset_urls" | tr -d ' ')"
  passed=$((passed + 1))
  rm -f "$response_file"
}

# Public pages and APIs: no mutations.
probe 'home page' GET '/' 200
probe 'about page' GET '/about' 200
probe 'brands page' GET '/brands' 200
probe 'vehicle category page' GET '/category/cars' 200
probe 'comparison page' GET '/compare' 200
probe 'Telegram mini-app page' GET '/telegram' 200
probe 'Telegram service infographic' GET '/images/telegram-service-infographic.png' 200
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
probe 'reviews page' GET '/reviews' 200
probe 'map page' GET '/map' 200
probe 'help page' GET '/help' 200
probe 'help rules page' GET '/help/rules' 200
probe 'help safety page' GET '/help/safety' 200
probe 'help selling page' GET '/help/sell' 200
probe 'help support page' GET '/help/support' 200
probe 'privacy page' GET '/legal/privacy' 200
probe 'terms page' GET '/legal/terms' 200
probe 'sign-in page' GET '/auth/signin' 200
probe 'sign-up page' GET '/auth/signup' 200
probe 'password recovery page' GET '/auth/forgot-password' 200
probe_body 'news API schema' GET '/api/news?limit=3' 200 '"news"[[:space:]]*:[[:space:]]*\['
probe_body 'auctions API schema' GET '/api/auctions?limit=2' 200 '"listings"[[:space:]]*:[[:space:]]*\['
probe_body 'auction analytics schema' GET '/api/auctions?limit=2' 200 '"analytics"[[:space:]]*:'
probe_body 'exchange-rate API schema' GET '/api/exchange-rates' 200 '"rates"[[:space:]]*:'
probe_body 'fuel-stations API schema' GET '/api/fuel-stations?city=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0' 200 '"stations"[[:space:]]*:[[:space:]]*\['
probe_body 'vehicle brand directory schema' GET '/api/v1/brands' 200 '"brands"[[:space:]]*:'
probe 'vehicle brand category validation' GET '/api/v1/brands?category=INVALID' 400
probe_body 'listing categories schema' GET '/api/categories' 200 '"categories"[[:space:]]*:[[:space:]]*\['
probe_body 'parts catalogue schema' GET '/api/parts?limit=2' 200 '"parts"[[:space:]]*:[[:space:]]*\['
probe_body 'public review feed schema' GET '/api/reviews?limit=2' 200 '"reviews"[[:space:]]*:[[:space:]]*\['
probe_body 'guest support bootstrap schema' GET '/api/support/chat' 200 '"quickReplies"[[:space:]]*:[[:space:]]*\['
probe_body 'robots policy exposes sitemap' GET '/robots.txt' 200 'Sitemap:[[:space:]]*https://lewheel\.ru/sitemap\.xml'
probe_body 'sitemap XML schema' GET '/sitemap.xml' 200 '<urlset[^>]*xmlns="http://www\.sitemaps\.org/schemas/sitemap/0\.9"'
audit_home_assets

# Browser routes guarded by middleware must always send an unauthenticated
# visitor to the public sign-in page rather than render private content.
probe 'dashboard page requires login' GET '/dashboard' '307|308'
probe 'favorites page requires login' GET '/favorites' '307|308'
probe 'messages page requires login' GET '/messages' '307|308'
probe 'notification page requires login' GET '/notifications' '307|308'
probe 'listing wizard requires login' GET '/listings/create/vehicle' '307|308'
probe 'part wizard requires login' GET '/listings/create/part' '307|308'
probe 'delivery workspace requires login' GET '/dashboard/deliveries' '307|308'
probe 'new conversation requires login' GET '/messages/new' '307|308'

# Boundary checks: invalid or unauthorized requests must not be accepted.
probe 'auction validation' GET '/api/auctions?country=INVALID' 400
probe 'news invalid page rejected' GET '/api/news?page=not-a-number' 400
probe 'news zero page rejected' GET '/api/news?page=0' 400
probe 'news oversized page rejected' GET '/api/news?page=10001' 400
probe 'news zero limit rejected' GET '/api/news?limit=0' 400
probe 'news oversized limit rejected' GET '/api/news?limit=51' 400
probe 'news invalid sort rejected' GET '/api/news?sort=unknown' 400
probe 'generic auction detail hidden' GET '/api/auctions/26cc45ec-c63f-496c-b15a-4a5232c1fc0f' 404
probe 'news import without token' POST '/api/news/import' 401 -H 'Content-Type: application/json' --data '{}'
probe 'parser import without token' POST '/api/parser/auctions' 401 -H 'Content-Type: application/json' --data '{}'
probe 'Encar parser without token' POST '/api/parser/encar' 401 -H 'Content-Type: application/json' --data '{}'
probe 'Encar refresh without token' POST '/api/parser/encar/refresh' 401 -H 'Content-Type: application/json' --data '{}'
probe 'Encar sync without token' POST '/api/parser/encar/sync' 401 -H 'Content-Type: application/json' --data '{}'
probe 'admin stats without session' GET '/api/admin/stats' '401|403'
probe 'admin listing queue without session' GET '/api/admin/listings' 403
probe 'admin reports without session' GET '/api/admin/reports' 403
probe 'admin auction inquiries without session' GET '/api/admin/auctions/inquiries' 403
probe 'admin auction metrics without session' GET '/api/admin/auctions/stats' 403
probe 'admin role update without session' PATCH '/api/admin/users/not-a-user/role' 403 -H 'Content-Type: application/json' --data '{}'
probe 'admin delivery partners without session' GET '/api/admin/delivery-organizations' 403
probe 'admin delivery partner mutation without session' PATCH '/api/admin/delivery-organizations' 403 -H 'Content-Type: application/json' --data '{}'
probe 'admin support queue without session' GET '/api/admin/support' 403
probe 'delivery orders without session' GET '/api/delivery-orders' 401
probe 'partner auction offers without session' GET '/api/partner/auction-offers' 401
probe 'delivery order detail without session' GET '/api/delivery-orders/not-a-real-order' 401
probe 'favorites API without session' GET '/api/favorites' 401
probe 'garage API without session' GET '/api/garage' 401
probe 'messages API without session' GET '/api/messages' 401
probe 'notifications API without session' GET '/api/notifications' 401
probe 'dashboard statistics without session' GET '/api/dashboard/stats' 401
probe 'vehicle garage API without session' GET '/api/vehicles' 401
probe 'upload without session' POST '/api/upload' 401
probe 'listing creation without session' POST '/api/listings' 401 -H 'Content-Type: application/json' --data '{}'
probe 'part creation without session' POST '/api/parts' 401 -H 'Content-Type: application/json' --data '{}'
probe 'message creation without session' POST '/api/messages' 401 -H 'Content-Type: application/json' --data '{}'
probe 'review creation without session' POST '/api/reviews' 401 -H 'Content-Type: application/json' --data '{}'
probe 'listing promotion without session' POST '/api/listings/not-a-real-listing/promote' 401 -H 'Content-Type: application/json' --data '{}'
probe 'listing report without session' POST '/api/listings/not-a-real-listing/reports' 401 -H 'Content-Type: application/json' --data '{}'
probe 'AI valuation without session' POST '/api/ai/valuation' 401 -H 'Content-Type: application/json' --data '{}'
probe 'AI smart matching without session' POST '/api/ai/smart-matching' 401 -H 'Content-Type: application/json' --data '{}'
probe 'AI history check without session' POST '/api/ai/history-check' 401 -H 'Content-Type: application/json' --data '{}'
probe 'AI price prediction without session' POST '/api/ai/price-prediction' 401 -H 'Content-Type: application/json' --data '{}'
probe 'AI damage assessment without session' POST '/api/ai/damage-assessment' 401 -H 'Content-Type: application/json' --data '{}'
probe 'payment intent without session' POST '/api/payment/create-intent' 401 -H 'Content-Type: application/json' --data '{}'
probe 'payment webhook unsigned' POST '/api/payment/webhook' '400|503' -H 'Content-Type: application/json' --data '{}'
probe 'Telegram webhook without secret' POST '/api/telegram/webhook' '401|503' -H 'Content-Type: application/json' --data '{}'
probe 'web registration is closed in favor of Telegram' POST '/api/auth/register' 410 -H 'Content-Type: application/json' --data '{'
probe 'password recovery malformed JSON rejected' POST '/api/auth/forgot-password' 400 -H 'Content-Type: application/json' --data '{'
probe 'password reset malformed JSON rejected' POST '/api/auth/reset-password' 400 -H 'Content-Type: application/json' --data '{'
probe 'Telegram OTP request endpoint is retired' POST '/api/auth/telegram/request-code' 410 -H 'Content-Type: application/json' --data '{'
probe 'Telegram OTP verification endpoint is retired' POST '/api/auth/telegram/verify-code' 410 -H 'Content-Type: application/json' --data '{'
probe 'web registration remains closed for invalid payloads' POST '/api/auth/register' 410 -H 'Content-Type: application/json' --data '{"email":"not-an-email","password":"x","name":""}'

headers="$(curl -sSI "${curl_options[@]}" "$base_url/api/news?limit=1" || true)"
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
