import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { SITE_MOBILE_NAVIGATION, TELEGRAM_TAB_NAVIGATION } from "../src/lib/navigation-registry.ts"

/* Человек открывает то сайт с телефона, то мини-приложение — в течение
   одного дня и по одному и тому же поводу. Наборы кнопок внизу разошлись:
   заправки стояли вторыми на сайте и последними в мини-приложении, и
   назывались то «Заправки», то «Бензин». Это читается как два разных
   сервиса, и кнопку приходится искать заново каждый раз. */

test("заправки стоят на одном месте в обоих меню", () => {
  const site = SITE_MOBILE_NAVIGATION.findIndex((item) => item.id === "fuel-map")
  const telegram = TELEGRAM_TAB_NAVIGATION.findIndex((item) => item.id === "fuel")

  assert.notEqual(site, -1, "на сайте нет заправок")
  assert.equal(site, telegram, "заправки на разных местах")
})

test("заправки называются одинаково", () => {
  const site = SITE_MOBILE_NAVIGATION.find((item) => item.id === "fuel-map")
  const telegram = TELEGRAM_TAB_NAVIGATION.find((item) => item.id === "fuel")

  assert.equal(site?.label, telegram?.label)
})

test("чаты стоят на одном месте", () => {
  /* Разное место одного и того же раздела заставляет человека каждый раз
     перечитывать всю панель.

     Форума здесь нет намеренно: внутри приложения он не написан, и
     вкладка увела бы на обычный сайт, откуда в ленту не вернуться. */
  const site = SITE_MOBILE_NAVIGATION.findIndex((item) => item.id === "messages")
  const telegram = TELEGRAM_TAB_NAVIGATION.findIndex((item) => item.id === "chats")

  assert.equal(site, telegram)
})


test("в обеих панелях по пять кнопок", () => {
  /* Шестая не помещается на телефоне: подписи сжимаются до нечитаемых. */
  assert.equal(SITE_MOBILE_NAVIGATION.length, 5)
  assert.equal(TELEGRAM_TAB_NAVIGATION.length, 5)
})

test("расхождения только там, где они вынужденны", () => {
  /* Совпадать должны места, где человек ищет одно и то же: заправки и
     чаты. Различий три, и каждое объяснимо.

     Первое место — лента: на сайте «Главная» со всеми разделами, в
     приложении «Свежее» с лентой машин; приложение открывают ради машин,
     а не ради витрины сервисов.

     Третье — «Подать» против «Аукционов»: подача переехала на главную
     кнопку Telegram, и место отдано аукционам, которых иначе в панели нет.

     Четвёртое — «Форум» против «Новостей»: форум внутри приложения не
     написан, и вкладка увела бы на обычный сайт с десктопной шапкой во
     весь экран телефона, откуда в ленту не вернуться. */
  const site = SITE_MOBILE_NAVIGATION.map((item) => item.id)
  const telegram = TELEGRAM_TAB_NAVIGATION.map((item) => item.id)

  const pairs: Record<string, string> = { "fuel-map": "fuel", messages: "chats" }
  const differing = site
    .map((id, index) => ({ index, same: telegram[index] === (pairs[id] ?? id) }))
    .filter((row) => !row.same)
    .map((row) => row.index)

  assert.deepEqual(differing, [0, 2, 3], "разошлось не то, что ожидалось")
})
