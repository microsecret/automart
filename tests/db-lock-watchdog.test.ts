import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

/* 21 октября 2026 зависшая запись держала базу 43 минуты: сайт отвечал
   «Неверный пароль» всем, бот и заправки падали с P1008. Сторож делает то,
   что сделал бы дежурный, — но не должен перезапускать сайт посреди
   законно долгой операции и не должен делать это по кругу. */
const script = readFileSync(new URL("../scripts/db-lock-watchdog.sh", import.meta.url), "utf8")

test("сторож базы молчит, пока записи нет или она свежая", () => {
  assert.match(script, /\[ -f "\$JOURNAL" \] \|\| exit 0/)
  assert.match(script, /\[ "\$age" -ge "\$STUCK_SECONDS" \] \|\| exit 0/)
})

test("сторож базы не трогает деплой, копию базы и миграцию", () => {
  assert.match(script, /automart-deploy-pending/)
  assert.match(script, /scripts\/backup-db\.mjs/)
  assert.match(script, /prisma migrate/)
})

test("сторож базы перезапускает только при жалобах службы и не по кругу", () => {
  assert.match(script, /grep -c "P1008"/)
  assert.match(script, /COOLDOWN_SECONDS/)
  /* Улики сохраняются до перезапуска: причина зависания не найдена. */
  assert.ok(script.indexOf("/proc/locks") < script.indexOf("systemctl restart"), "улики должны сниматься до перезапуска")
})

test("деплой ставит сторожа базы в расписание", () => {
  const deploy = readFileSync(new URL("../scripts/deploy-production.sh", import.meta.url), "utf8")
  assert.match(deploy, /install-db-watchdog-cron\.sh/)
  const install = readFileSync(new URL("../scripts/install-db-watchdog-cron.sh", import.meta.url), "utf8")
  assert.match(install, /flock -n \/tmp\/automart-db-watchdog\.lock/)
  assert.match(install, /replace_cron_job "# automart-db-watchdog"/)
})
