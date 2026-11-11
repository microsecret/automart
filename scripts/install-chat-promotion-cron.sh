#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/cron-install-lib.sh"
replace_cron_job "# automart-chat-promotion" "3,18,33,48 * * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-chat-promotion.lock bash scripts/run-chat-promotion.sh >> /var/log/automart-chat-promotion.log 2>&1 # automart-chat-promotion"
