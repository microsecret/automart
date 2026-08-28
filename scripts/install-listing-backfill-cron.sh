#!/usr/bin/env bash
set -euo pipefail

# Объявления, не попавшие в чаты, уходят по одному в час.
#
# Автопубликация срабатывает при одобрении модератором. Объявления,
# одобренные до её появления, не уйдут в чаты никогда, а те, чья
# отправка сорвалась из-за сети, — потеряются молча. Досылка закрывает
# оба случая.
#
# По одному за запуск: десять постов подряд читаются как захват группы,
# даже когда каждое объявление по делу. Очередь из десяти машин при
# ежечасном запуске расходится за десять часов.
#
# Минута 53 свободна: остальные задания стоят на 8, 13, 15, 17, 20, 27,
# 35 и 41 — одновременный запуск двух рассылок дал бы два поста подряд.
#
# Kept idempotent so deploys replace, rather than duplicate, the tagged entry.
JOB="53 * * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-listing-backfill.lock bash scripts/run-listing-backfill.sh >> /var/log/automart-listing-backfill.log 2>&1 # automart-listing-backfill"
# shellcheck source=scripts/cron-install-lib.sh
source "$(dirname "$0")/cron-install-lib.sh"

replace_cron_job "# automart-listing-backfill" "$JOB"
echo "Installed automart listing backfill cron"
