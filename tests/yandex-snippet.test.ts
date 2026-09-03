import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { normalizeQueue, parseYandexSnippet } from "../src/lib/yandex-snippet.ts"

test("подпись Яндекса разбирается на имя, марки и очередь", () => {
  /* Яндекс рисует название, список марок и очередь разными элементами, а
     textContent склеивает их без разделителя: получается
     «Нефтьмагистраль92, 95, 95+, ДТ · Нет очереди». Граница между именем
     и марками ищется по первой цифре после буквы — иначе в название
     попадал бы весь ассортимент. */
  const parsed = parseYandexSnippet("Нефтьмагистраль92, 95, 95+, ДТ · Нет очереди")

  assert.equal(parsed.name, "Нефтьмагистраль")
  assert.deepEqual(parsed.fuels, ["AI92", "AI95", "DT"])
  assert.equal(parsed.queue, "Нет очереди")
})

test("подпись без очереди и без марок не ломает разбор", () => {
  /* У части точек Яндекс отдаёт только название: заправка есть в
     справочнике, но ассортимент не заполнен. Пустой список честнее
     выдуманного. */
  const bare = parseYandexSnippet("Лукойл")
  assert.equal(bare.name, "Лукойл")
  assert.deepEqual(bare.fuels, [])
  assert.equal(bare.queue, null)

  assert.deepEqual(parseYandexSnippet(null), { name: null, fuels: [], queue: null })
})

test("«95+» считается тем же девяносто пятым", () => {
  /* Улучшенные марки идут отдельными позициями, но колонка та же.
     Отдельной марки «95+» у нас нет, и заводить её значило бы дробить
     фильтр на карте без пользы для водителя. */
  const parsed = parseYandexSnippet("Газпромнефть95, 95+, ДТ, ДТ+ · Очередь")
  assert.deepEqual(parsed.fuels, ["AI95", "DT"])
})

test("очередь не выдаёт себя за отсутствие топлива", () => {
  /* Очередь означает ровно обратное: за топливом стоят, значит оно есть.
     Если бы очередь понижала статус, карта отговаривала бы ехать туда,
     где заправиться как раз можно. */
  assert.equal(normalizeQueue("Нет очереди"), "Нет очереди")
  assert.equal(normalizeQueue("Очередь 10 мин"), "Очередь 10 мин")
  assert.equal(normalizeQueue("Круглосуточно"), null)
  assert.equal(normalizeQueue(null), null)
})
