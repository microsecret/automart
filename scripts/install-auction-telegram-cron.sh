#!/usr/bin/env bash
set -euo pipefail

# Лента должна подхватывать новые лоты сама: коллектор пополняет каталог
# каждые 20 минут, поэтому публикация раз в час выдерживает поток новинок и
# при этом не превращает канал в поток сообщений.
#
# Kept idempotent so deploys replace, rather than duplicate, the tagged entry.
# `flock -n` пропускает запуск, если предыдущий ещё идёт: между постами есть
# намеренная пауза, и наложение двух прогонов дало бы дубли в канале.
JOB="8 * * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-auction-telegram.lock /usr/bin/node scripts/publish-auction-highlights.mjs >> /var/log/automart-auction-telegram.log 2>&1 # automart-auction-telegram"
CURRENT="$(crontab -l 2>/dev/null || true)"
FILTERED="$(printf '%s\n' "$CURRENT" | grep -vF "# automart-auction-telegram" || true)"

printf '%s\n%s\n' "$FILTERED" "$JOB" | crontab -
echo "Installed automart auction Telegram cron"
