import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const cronInstaller = readFileSync(new URL("../scripts/install-auction-telegram-cron.sh", import.meta.url), "utf8")
const collector = readFileSync(new URL("../scripts/run-encar-collector.sh", import.meta.url), "utf8")
const exampleEnvironment = readFileSync(new URL("../.env.example", import.meta.url), "utf8")

test("подборка аукционных лотов запускается не чаще раза в восемь часов", () => {
  assert.match(cronInstaller, /JOB="8 \*\/8 \* \* \*/)
  assert.match(cronInstaller, /flock -n \/tmp\/automart-auction-telegram\.lock/)
})

test("коллектор данных не отправляет сообщения в Telegram", () => {
  assert.doesNotMatch(collector, /publish-auction-highlights/)
  assert.doesNotMatch(collector, /Telegram auction highlights/)
})

test("автопубликация выключена по умолчанию и задержки документированы", () => {
  assert.match(exampleEnvironment, /AUTOMART_AUCTION_TELEGRAM_CRON="off"/)
  assert.match(exampleEnvironment, /TELEGRAM_AUCTION_POST_DELAY_MIN_MS="10000"/)
  assert.match(exampleEnvironment, /TELEGRAM_AUCTION_POST_DELAY_MAX_MS="15000"/)
})
