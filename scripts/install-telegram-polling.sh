#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Telegram polling setup must run as root" >&2
  exit 1
fi

cd /root/AutoMart
test -s .env
test -s scripts/telegram-polling.mjs
test -s scripts/systemd/automart-telegram.service

install -m 0644 scripts/systemd/automart-telegram.service /etc/systemd/system/automart-telegram.service
systemctl daemon-reload
systemctl enable --now automart-telegram.service
systemctl is-active --quiet automart-telegram.service
echo "LeWheel Telegram polling service is active"
