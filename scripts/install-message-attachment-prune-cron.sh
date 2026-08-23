#!/usr/bin/env bash
set -euo pipefail

# Файлы переписки приватны и не должны бесконечно занимать диск после будущего
# удаления сообщений или аккаунтов. Проверка идёт раз в неделю; суточная
# задержка исключает гонку с загрузкой, где файл записывается перед транзакцией.
# Скрипт сам сверяет каждый безопасный UUID-ключ с БД и удаляет только сироты.
JOB="53 4 * * 1 cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-message-attachment-prune.lock /usr/bin/node --env-file=.env scripts/prune-message-attachments.mjs --apply --min-age-hours=24 >> /var/log/automart-message-attachment-prune.log 2>&1 # automart-message-attachment-prune"
# shellcheck source=scripts/cron-install-lib.sh
source "$(dirname "$0")/cron-install-lib.sh"

replace_cron_job "# automart-message-attachment-prune" "$JOB"
echo "Installed automart message-attachment-prune cron"
