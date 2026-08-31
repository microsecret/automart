#!/usr/bin/env bash
set -euo pipefail

# Сверка оплат с кассой — каждые пять минут.
#
# Продвижение включается по уведомлению ЮKassa, и это единственная нить,
# на которой держится заработок площадки. Нить тонкая: адрес уведомлений
# задаётся руками в кабинете кассы, его легко не указать или сбить при
# смене домена, а ЮKassa о такой ошибке не сообщает.
#
# Человек тогда платит, деньги списываются, а объявление не
# продвигается. Пять минут — потолок ожидания: за это время он ещё
# смотрит на страницу и успевает увидеть, что услуга включилась.
#
# Нагрузки почти нет: сверяются только заказы со статусом «ждёт оплаты»,
# которых в обычный день единицы. Пустой проход — один запрос к базе.
#
# Kept idempotent so deploys replace, rather than duplicate, the tagged entry.
JOB="*/5 * * * * cd /root/AutoMart && /usr/bin/flock -n /tmp/automart-promotion-reconcile.lock bash scripts/run-promotion-reconcile.sh >> /var/log/automart-promotion-reconcile.log 2>&1 # automart-promotion-reconcile"
# shellcheck source=scripts/cron-install-lib.sh
source "$(dirname "$0")/cron-install-lib.sh"

replace_cron_job "# automart-promotion-reconcile" "$JOB"
