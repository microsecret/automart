import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { hasConsistentOctaneOrder, isPlausiblePrice, sanitizeStationPrices } from "../src/lib/fuel-price-sanity.ts"

// Все числа ниже взяты из боевой базы 16 сентября 2026, а не придуманы:
// так тест проверяет ровно те случаи, ради которых отсев написан.

test("обычные цены проходят", () => {
  assert.equal(isPlausiblePrice("AI95", 7_320), true)
  assert.equal(isPlausiblePrice("AI92", 6_750), true)
  assert.equal(isPlausiblePrice("DT", 8_060), true)
  assert.equal(isPlausiblePrice("GAS", 3_600), true)
})

test("дешёвые регионы не отсекаются полом", () => {
  // Первый процентиль базы: АИ-92 по 60 ₽ и газ по 28 ₽ существуют.
  assert.equal(isPlausiblePrice("AI92", 6_000), true)
  assert.equal(isPlausiblePrice("GAS", 2_798), true)
})

test("АИ-95 за 195 рублей из Тюмени отбрасывается", () => {
  assert.equal(isPlausiblePrice("AI95", 19_500), false)
})

test("АИ-92 за 229 рублей — максимум базы — отбрасывается", () => {
  assert.equal(isPlausiblePrice("AI92", 22_900), false)
})

test("дорогим районам вроде Камчатки место остаётся", () => {
  // Сотый за 130 ₽ на Дальнем Востоке — дорого, но правда.
  assert.equal(isPlausiblePrice("AI100", 13_000), true)
})

test("незнакомая марка не выбрасывается", () => {
  assert.equal(isPlausiblePrice("AI80", 5_000), true)
})

test("нечисловое и отрицательное отбрасывается", () => {
  assert.equal(isPlausiblePrice("AI95", Number.NaN), false)
  assert.equal(isPlausiblePrice("AI80", -100), false)
})

test("нормальный порядок марок принимается", () => {
  assert.equal(hasConsistentOctaneOrder([
    { fuel: "AI92", priceRub: 6_750 },
    { fuel: "AI95", priceRub: 7_320 },
    { fuel: "AI100", priceRub: 9_849 },
  ]), true)
})

test("перевёрнутая станция «Иликом» из Казани ловится", () => {
  // АИ-100 за 110 ₽ при АИ-92 за 129 ₽ — так не бывает.
  assert.equal(hasConsistentOctaneOrder([
    { fuel: "AI100", priceRub: 11_000 },
    { fuel: "AI92", priceRub: 12_900 },
    { fuel: "AI95", priceRub: 13_900 },
  ]), false)
})

test("равные цены допускаются — это бывает по акции", () => {
  assert.equal(hasConsistentOctaneOrder([
    { fuel: "AI92", priceRub: 6_750 },
    { fuel: "AI95", priceRub: 6_750 },
  ]), true)
})

test("пропуск в середине ряда не мешает", () => {
  assert.equal(hasConsistentOctaneOrder([
    { fuel: "AI92", priceRub: 6_750 },
    { fuel: "AI100", priceRub: 9_800 },
  ]), true)
})

test("станция с одной маркой сама себе не противоречит", () => {
  assert.equal(hasConsistentOctaneOrder([{ fuel: "AI95", priceRub: 7_320 }]), true)
  assert.equal(hasConsistentOctaneOrder([]), true)
})

test("АИ-98 дешевле АИ-95 — это рынок, а не порча", () => {
  // Башнефть в Ижевске: 92 за 66,70 · 95 за 68,30 · 98 за 65,70. Первая
  // версия правила держала 98-й в ряду и снесла эти честные цены при
  // пробном прогоне чистки. Замер по базе: у 328 станций 98-й дешевле
  // 95-го при разумных ценах обеих марок — 98-й идёт по акции, а
  // «премиальный» 95-й с присадками стоит дороже простого 98-го.
  assert.equal(hasConsistentOctaneOrder([
    { fuel: "AI92", priceRub: 6_670 },
    { fuel: "AI95", priceRub: 6_830 },
    { fuel: "AI98", priceRub: 6_570 },
  ]), true)
})

test("Татнефть в Казани с нормальными ценами не трогается", () => {
  // 92 за 63,07 · 95 за 68,22 · 98 за 100 · 100 за 97,05 · ДТ за 84,85.
  // Здесь 98-й дороже сотого — тоже не повод считать станцию порченой.
  const prices = [
    { fuel: "AI100", priceRub: 9_705 },
    { fuel: "AI92", priceRub: 6_307 },
    { fuel: "AI95", priceRub: 6_822 },
    { fuel: "AI98", priceRub: 10_000 },
    { fuel: "DT", priceRub: 8_485 },
  ]
  assert.deepEqual(sanitizeStationPrices(prices), prices)
})

test("АИ-95 дешевле АИ-92 — вот это порча", () => {
  // Роснефть в Волгограде: 92 за 65, а 95, 98 и ДТ ровно по 55. Цены
  // разумны поштучно, но 95-й дешевле 92-го не бывает.
  assert.equal(hasConsistentOctaneOrder([
    { fuel: "AI92", priceRub: 6_500 },
    { fuel: "AI95", priceRub: 5_500 },
  ]), false)
})

test("дизель и газ с бензином не сравниваются", () => {
  // Дизель дешевле АИ-92 зимой и дороже летом — это не ошибка.
  assert.equal(hasConsistentOctaneOrder([
    { fuel: "DT", priceRub: 8_060 },
    { fuel: "AI92", priceRub: 6_750 },
    { fuel: "AI95", priceRub: 7_320 },
  ]), true)
  // Газ втрое дешевле — и это тоже норма.
  assert.equal(hasConsistentOctaneOrder([
    { fuel: "GAS", priceRub: 3_600 },
    { fuel: "AI92", priceRub: 6_750 },
  ]), true)
})

test("честная станция остаётся нетронутой", () => {
  const prices = [
    { fuel: "AI92", priceRub: 6_750 },
    { fuel: "AI95", priceRub: 7_320 },
    { fuel: "DT", priceRub: 8_060 },
  ]
  assert.deepEqual(sanitizeStationPrices(prices), prices)
})

test("станция «Иликом» выбрасывается целиком", () => {
  assert.deepEqual(sanitizeStationPrices([
    { fuel: "AI100", priceRub: 11_000 },
    { fuel: "AI92", priceRub: 12_900 },
    { fuel: "AI95", priceRub: 13_900 },
    { fuel: "DT", priceRub: 13_900 },
  ]), [])
})

test("одиночный выброс снимается, остальное остаётся", () => {
  // Коридор убирает 195 ₽ за АИ-95, а порядок оставшихся марок цел.
  assert.deepEqual(sanitizeStationPrices([
    { fuel: "AI92", priceRub: 6_750 },
    { fuel: "AI95", priceRub: 19_500 },
    { fuel: "DT", priceRub: 8_060 },
  ]), [
    { fuel: "AI92", priceRub: 6_750 },
    { fuel: "DT", priceRub: 8_060 },
  ])
})

test("лишние поля записи сохраняются", () => {
  const prices = [{ fuel: "AI95", priceRub: 7_320, confirmations: 3, observedAt: null }]
  assert.deepEqual(sanitizeStationPrices(prices), prices)
})

test("когда верить нечему, возвращается пустой список", () => {
  assert.deepEqual(sanitizeStationPrices([{ fuel: "AI95", priceRub: 19_500 }]), [])
  assert.deepEqual(sanitizeStationPrices([]), [])
})

test("выброс, ломавший порядок марок, не роняет станцию", () => {
  // Тонкий случай: сырой АИ-92 за 129 ₽ переворачивает ряд, но его же
  // снимает коридор — и оставшиеся марки честны. Если бы порядок
  // проверялся до коридора, станция потеряла бы годные цены.
  assert.deepEqual(sanitizeStationPrices([
    { fuel: "AI92", priceRub: 12_900 },
    { fuel: "AI95", priceRub: 7_320 },
    { fuel: "AI100", priceRub: 9_800 },
  ]), [
    { fuel: "AI95", priceRub: 7_320 },
    { fuel: "AI100", priceRub: 9_800 },
  ])
})
