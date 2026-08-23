import assert from "node:assert/strict"
import test from "node:test"
import {
  isRepeatedVisit, registerVisitScreen, resetVisitScreens,
  visitScreen, VISIT_RETRY_WINDOW_MS,
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
} from "../src/lib/visit-dedup.ts"

const T0 = 1_700_000_000_000

test("экран собирается из пути и строки запроса", () => {
  assert.equal(visitScreen("/auctions", "/auctions?country=JP"), "/auctions?country=JP")
  assert.equal(visitScreen("/auctions", "/auctions"), "/auctions")
})

test("экран без строки запроса совпадает с путём", () => {
  assert.equal(visitScreen("/", undefined), "/")
  assert.equal(visitScreen("/parts-finder", null), "/parts-finder")
  assert.equal(visitScreen("/parts-finder", 42), "/parts-finder")
})

test("подделанный экран не подменяет путь", () => {
  // Экран приходит с клиента: без проверки им можно было бы обойти
  // дедупликацию или подменить раздел в отчёте.
  assert.equal(visitScreen("/auctions", "/admin/users"), "/auctions")
  assert.equal(visitScreen("/auctions", "/auctions-other?x=1"), "/auctions")
  assert.equal(visitScreen("/auctions", ""), "/auctions")
})

test("повторная отправка того же экрана не считается просмотром", () => {
  // Браузеры и service worker переотправляют beacon: один просмотр не должен
  // становиться двумя.
  const previous = { screen: "/", at: T0 }
  assert.equal(isRepeatedVisit({ screen: "/", at: T0 + 500 }, previous), true)
})

test("переход между разделами считается всегда, даже сразу", () => {
  const previous = { screen: "/", at: T0 }
  assert.equal(isRepeatedVisit({ screen: "/auctions", at: T0 + 100 }, previous), false)
})

test("смена фильтра каталога — это переход, а не дубль", () => {
  // Главный дефект прежней проверки: она сравнивала только путь, поэтому
  // «/auctions?country=JP» → «?country=KR» просмотром не считался.
  const previous = { screen: "/auctions?country=JP", at: T0 }
  assert.equal(isRepeatedVisit({ screen: "/auctions?country=KR", at: T0 + 1_000 }, previous), false)
})

test("возврат на тот же экран после окна считается заново", () => {
  const previous = { screen: "/", at: T0 }
  assert.equal(isRepeatedVisit({ screen: "/", at: T0 + VISIT_RETRY_WINDOW_MS }, previous), false)
  assert.equal(isRepeatedVisit({ screen: "/", at: T0 + VISIT_RETRY_WINDOW_MS - 1 }, previous), true)
})

test("первый визит посетителя никогда не дубль", () => {
  assert.equal(isRepeatedVisit({ screen: "/", at: T0 }, null), false)
  assert.equal(isRepeatedVisit({ screen: "/", at: T0 }, undefined), false)
})

test("сбитые часы клиента не съедают событие", () => {
  // Отрицательная разница означает рассинхрон: записать лишнее дешевле, чем
  // потерять настоящий просмотр.
  const previous = { screen: "/", at: T0 }
  assert.equal(isRepeatedVisit({ screen: "/", at: T0 - 5_000 }, previous), false)
})

test("состояние ведётся отдельно по каждому посетителю", () => {
  resetVisitScreens()
  assert.equal(registerVisitScreen("session-a", "/", T0), false)
  // Второй человек на том же экране — свой просмотр, а не чужой дубль.
  assert.equal(registerVisitScreen("session-b", "/", T0 + 10), false)
  assert.equal(registerVisitScreen("session-a", "/", T0 + 20), true)
})

test("путь по сессии: переходы туда и обратно считаются", () => {
  resetVisitScreens()
  // A -> B -> A внутри десяти секунд. Прежняя проверка по базе теряла
  // возврат на A: замер нашёл десять таких случаев на боевых данных.
  assert.equal(registerVisitScreen("session", "/", T0), false)
  assert.equal(registerVisitScreen("session", "/auctions", T0 + 2_000), false)
  assert.equal(registerVisitScreen("session", "/", T0 + 4_000), false)
})

test("серия дублей отсекается, но окно не сдвигается бесконечно", () => {
  resetVisitScreens()
  assert.equal(registerVisitScreen("session", "/listings", T0), false)
  assert.equal(registerVisitScreen("session", "/listings", T0 + 100), true)
  assert.equal(registerVisitScreen("session", "/listings", T0 + 200), true)
  // Окно считается от первой отправки серии. Иначе человек, обновляющий
  // страницу раз в девять секунд, не засчитывался бы вообще никогда.
  assert.equal(registerVisitScreen("session", "/listings", T0 + VISIT_RETRY_WINDOW_MS + 100), false)
})

test("частые обновления страницы всё-таки попадают в счётчик", () => {
  resetVisitScreens()
  let counted = 0
  // Раз в девять секунд — быстрее окна, но это живой человек, а не повтор
  // beacon-а: половина таких обновлений обязана дойти до счётчика.
  for (let index = 0; index < 6; index += 1) {
    if (!registerVisitScreen("session", "/", T0 + index * 9_000)) counted += 1
  }
  assert.ok(counted >= 3, `засчитано ${counted} из 6 обновлений`)
})
