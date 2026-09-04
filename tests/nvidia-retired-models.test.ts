import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("../src/lib/nvidia-translate.ts", import.meta.url), "utf8")

test("модель, снятая провайдером, больше не вызывается", () => {
  /* На ответ 410 провайдер пишет прямо: модель дожила до конца срока и
     недоступна. Она не воскреснет, а код звал её на каждом лоте — в логах
     шла стена одинаковых ошибок каждые несколько секунд.

     Так и вышло: перевод описаний встал 26 августа 2026 года, 644 лота из
     3511 сохранились по-корейски, и заметили это случайно, разбирая
     совсем другой отчёт. */
  assert.ok(source.includes("retiredModels"))
  assert.ok(source.includes("res.status === 410"))
})

test("выбор модели минует снятые", () => {
  /* Пара «быстрая для коротких полей, крупная для описаний» должна
     переживать потерю одной из них: описание на быстрой выйдет грубее, но
     карточка на корейском хуже. */
  assert.ok(source.includes("retiredModels.has(preferred)"))
  assert.ok(source.includes("retiredModels.has(fallback)"))
})

test("когда живых моделей нет, перевод сдаётся сразу", () => {
  /* Иначе прогон импорта перебирал бы все ключи ради заведомо
     невозможного ответа и упирался в бюджет времени на каждом лоте. */
  assert.ok(source.includes("сняты провайдером с обслуживания"))
})

test("пример настроек не предлагает снятые модели", () => {
  /* В .env.example стояли ровно те имена, которые провайдер отключил:
     новый разработчик поставил бы их и получил ту же тишину. */
  const example = readFileSync(new URL("../.env.example", import.meta.url), "utf8")
  const nvidiaLines = example.split(/\r?\n/).filter((line) => line.startsWith("NVIDIA_"))

  for (const line of nvidiaLines) {
    assert.ok(!line.includes("llama-3."), `в примере осталась снятая модель: ${line}`)
  }
})
