#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Production network setup must run as root" >&2
  exit 1
fi

command -v nginx >/dev/null 2>&1 || { echo "nginx is required" >&2; exit 1; }

install -D -m 0644 scripts/systemd/automart-network.conf /etc/systemd/system/automart.service.d/network.conf
install -D -m 0644 scripts/nginx/automart-4000.conf /etc/nginx/conf.d/automart-4000.conf

# Validate the future proxy before moving the application listener.
nginx -t
systemctl daemon-reload
systemctl restart automart
systemctl is-active --quiet automart

# The application is now on 127.0.0.1:4001, so Nginx can safely claim the
# public :4000 entry point without changing customer-facing URLs.
application_ready=false
for _attempt in $(seq 1 45); do
  if curl --fail --silent http://127.0.0.1:4001/api/exchange-rates >/dev/null 2>&1; then
    application_ready=true
    break
  fi
  sleep 1
done
if [[ "$application_ready" != true ]]; then
  systemctl status automart --no-pager -l >&2 || true
  journalctl -u automart -n 80 --no-pager >&2 || true
  echo "AutoMart did not become healthy on 127.0.0.1:4001 within 45 seconds" >&2
  exit 1
fi
systemctl reload nginx
curl --fail --silent --show-error http://127.0.0.1:4000/api/exchange-rates >/dev/null
