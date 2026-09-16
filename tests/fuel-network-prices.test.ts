import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { buildNetworkPrices } from "../src/lib/fuel-network-prices.ts"

/** Короткая запись пробы: пять точек сети — минимум, чтобы строка прошла. */
function samples(brand: string, prices: number[], name = brand) {
  return prices.map((priceRub) => ({ name, brand, fuel: "AI95", priceRub }))
}

test("медиана по сети считается", () => {
  const rows = buildNetworkPrices(samples("Лукойл", [6_800, 6_900, 7_000, 7_100, 7_200]))
  assert.equal(rows.length, 1)
  assert.equal(rows[0].label, "Лукойл")
  assert.equal(rows[0].priceRub, 7_000)
  assert.equal(rows[0].stations, 5)
})

test("разные написания одной сети склеиваются", () => {
  // В базе лежат и «Газпром нефть», и «Газпромнефть», и «Газпром» —
  // водитель не должен видеть три строки об одной вывеске.
  const rows = buildNetworkPrices([
    ...samples("Газпром нефть", [7_000, 7_100]),
    ...samples("Газпромнефть", [7_200, 7_300]),
    ...samples("Газпром", [7_400]),
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].label, "Газпромнефть")
  assert.equal(rows[0].stations, 5)
})

test("Лукойл в разных регистрах — одна строка", () => {
  const rows = buildNetworkPrices([
    ...samples("Лукойл", [6_800, 6_900, 7_000]),
    ...samples("ЛУКОЙЛ", [7_100, 7_200]),
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].stations, 5)
})

test("порченая цена не сдвигает медиану — ради этого она и взята", () => {
  // Среднее по этому набору дало бы 92 ₽ при настоящих 70.
  const rows = buildNetworkPrices(samples("Лукойл", [6_900, 7_000, 7_000, 7_100, 19_500]))
  assert.equal(rows[0].priceRub, 7_000)
})

test("сеть с малым числом точек отбрасывается", () => {
  // «ОПТИ» с тремя точками давала в Уфе медиану 116 ₽ вместо 66 ₽.
  assert.deepEqual(buildNetworkPrices(samples("Опти", [6_615, 11_600, 11_600])), [])
})

test("безымянные заправки в сводку не попадают", () => {
  assert.deepEqual(
    buildNetworkPrices(samples("Независимая / Прочее", [6_800, 6_900, 7_000, 7_100, 7_200], "АЗС 24")),
    [],
  )
})

test("сводная метка газовых заправок не попадает", () => {
  // «Экогаз» и «Мосавтогаз» — разные сети под одной меткой, да и цена
  // газа втрое ниже: строка встала бы первой и сломала сортировку.
  assert.deepEqual(buildNetworkPrices([
    ...samples("Экогаз", [3_500, 3_600, 3_700]),
    ...samples("Мосавтогаз", [3_800, 3_900]),
  ]), [])
})

test("дешёвая сеть идёт первой", () => {
  const rows = buildNetworkPrices([
    ...samples("Лукойл", [7_000, 7_000, 7_000, 7_000, 7_000]),
    ...samples("Башнефть", [6_700, 6_700, 6_700, 6_700, 6_700]),
    ...samples("Татнефть", [6_800, 6_800, 6_800, 6_800, 6_800]),
  ])
  assert.deepEqual(rows.map((row) => row.label), ["Башнефть", "Татнефть", "Лукойл"])
})

test("фирменный цвет сети отдаётся — по нему её узнают на карте", () => {
  const rows = buildNetworkPrices(samples("Лукойл", [7_000, 7_000, 7_000, 7_000, 7_000]))
  assert.equal(rows[0].color, "#d8202f")
  assert.equal(rows[0].textColor, "#fff")
})

test("при чётном числе точек несуществующая цена не выдумывается", () => {
  const rows = buildNetworkPrices(samples("Лукойл", [7_000, 7_000, 7_010, 7_020, 7_030, 7_040]))
  // Полусумма середин дала бы 70,15 ₽ — такой цены на колонке нет.
  assert.equal(rows[0].priceRub, 7_010)
})

test("сеть с системно завышенной ценой не попадает в сводку", () => {
  // «Нефтьмагистраль» в Москве: 93 ₽ за АИ-92 и 104 ₽ за АИ-95 на
  // восьмидесяти восьми точках. Внутри записи всё согласовано, коридор
  // пройден — поштучные правила такое не видят. Но при медиане города
  // около 72 ₽ это вымысел, пришедший из обоих источников разом.
  const rows = buildNetworkPrices([
    ...samples("Лукойл", Array(40).fill(7_258)),
    ...samples("Роснефть", Array(40).fill(7_135)),
    ...samples("Нефтьмагистраль", Array(20).fill(10_400)),
  ])
  assert.deepEqual(rows.map((row) => row.label), ["Роснефть", "Лукойл"])
})

test("дороговизне в разумных пределах место остаётся", () => {
  // Сеть на вылете из города вправе стоить дороже соседей — но не в
  // полтора раза.
  const rows = buildNetworkPrices([
    ...samples("Лукойл", Array(40).fill(7_000)),
    ...samples("Роснефть", Array(40).fill(7_000)),
    ...samples("Трасса", Array(20).fill(9_800)),
  ])
  assert.equal(rows.length, 3)
  assert.equal(rows[rows.length - 1].label, "Трасса")
})

test("без данных сводка пуста", () => {
  assert.deepEqual(buildNetworkPrices([]), [])
})
