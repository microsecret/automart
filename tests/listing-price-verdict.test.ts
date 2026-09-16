import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { buildPriceVerdict, describePriceVerdict } from "../src/lib/listing-price-verdict.ts"

function samples(prices: number[], year = 2015) {
  return prices.map((price) => ({ price, year }))
}

test("цена в рынке так и называется", () => {
  const verdict = buildPriceVerdict(500_000, samples([480_000, 490_000, 500_000, 510_000, 520_000]))
  assert.equal(verdict?.tone, "fair")
  assert.equal(verdict?.marketPrice, 500_000)
  assert.equal(describePriceVerdict(verdict!), "В рынке")
})

test("цена заметно ниже похожих", () => {
  const verdict = buildPriceVerdict(400_000, samples([490_000, 495_000, 500_000, 505_000, 510_000]))
  assert.equal(verdict?.tone, "cheap")
  assert.equal(describePriceVerdict(verdict!), "На 20% ниже похожих")
})

test("цена заметно выше похожих", () => {
  const verdict = buildPriceVerdict(650_000, samples([490_000, 495_000, 500_000, 505_000, 510_000]))
  assert.equal(verdict?.tone, "pricey")
  assert.equal(describePriceVerdict(verdict!), "На 30% выше похожих")
})

test("колебание меньше десяти процентов не объявляется выгодой", () => {
  // Пять процентов объясняются пробегом и комплектацией, а не выгодой.
  const cheaper = buildPriceVerdict(475_000, samples([490_000, 495_000, 500_000, 505_000, 510_000]))
  assert.equal(cheaper?.tone, "fair")
  const dearer = buildPriceVerdict(525_000, samples([490_000, 495_000, 500_000, 505_000, 510_000]))
  assert.equal(dearer?.tone, "fair")
})

test("ровно на пороге оценка уже даётся", () => {
  const verdict = buildPriceVerdict(450_000, samples([490_000, 495_000, 500_000, 505_000, 510_000]))
  assert.equal(verdict?.tone, "cheap")
  assert.equal(describePriceVerdict(verdict!), "На 10% ниже похожих")
})

test("по четырём соседям оценка не даётся", () => {
  // Оценка по паре объявлений выглядит так же уверенно, как по сотне, —
  // поэтому её лучше не давать вовсе.
  assert.equal(buildPriceVerdict(500_000, samples([480_000, 490_000, 510_000, 520_000])), null)
  assert.equal(buildPriceVerdict(500_000, samples([480_000])), null)
  assert.equal(buildPriceVerdict(500_000, []), null)
})

test("одна порченая цена не переворачивает оценку", () => {
  // Медиана, а не среднее: объявление за миллиард не должно объявлять
  // нормальную цену «выгодной».
  const verdict = buildPriceVerdict(500_000, samples([490_000, 495_000, 500_000, 505_000, 99_000_000]))
  assert.equal(verdict?.tone, "fair")
  assert.equal(verdict?.marketPrice, 500_000)
})

test("нулевые и отрицательные цены отбрасываются", () => {
  assert.equal(buildPriceVerdict(0, samples([500_000, 500_000, 500_000, 500_000, 500_000])), null)
  assert.equal(buildPriceVerdict(-1, samples([500_000, 500_000, 500_000, 500_000, 500_000])), null)
  // Мусор в выборке не считается за соседа.
  assert.equal(buildPriceVerdict(500_000, samples([500_000, 0, 0, 0, 0])), null)
})

test("размер выборки возвращается — это мера доверия", () => {
  const verdict = buildPriceVerdict(500_000, samples([480_000, 490_000, 500_000, 510_000, 520_000, 530_000, 540_000]))
  assert.equal(verdict?.sampleSize, 7)
})

test("выборка страницы объявления берётся по модели, а не по марке", () => {
  /* Проверка на живых данных: сначала выборка бралась по одной марке, и
     на ВАЗ 2114 за 92 000 ₽ появился бейдж «на 50% ниже похожих», где
     похожими оказались Приоры за 255 000. Внутри марки цены расходятся
     в разы, и сравнивать надо модель с моделью.

     Тест читает сам запрос: вычислить эту ошибку из результата функции
     нельзя — она получает уже собранную выборку и честно считает по
     тому, что ей дали. */
  const page = readFileSync(new URL("../src/app/listings/vehicle/[id]/page.tsx", import.meta.url), "utf8")
  const query = page.slice(page.indexOf("const priceSamples"), page.indexOf("buildPriceVerdict(vehicle.price"))
  assert.match(query, /make: vehicle\.make/)
  assert.match(query, /model: vehicle\.model/)
})
