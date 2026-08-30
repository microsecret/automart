import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { getGenericIdentity, getNetworkIdentity, getStationIdentity } from "../src/lib/fuel-station-identity.ts"

const station = (name: string, fuels: string[] = [], extra: Record<string, unknown> = {}) =>
  ({ name, fuels, brand: null, operator: null, ...extra })

test("сеть узнаётся по названию", () => {
  // Человек находит свою заправку глазами, по фирменному цвету.
  assert.equal(getNetworkIdentity(station("Лукойл на Ленина"))?.label, "Лукойл")
  assert.equal(getNetworkIdentity(station("АЗС Татнефть"))?.label, "Татнефть")
})

test("сеть узнаётся и по вывеске, а не только по имени", () => {
  // В OpenStreetMap название часто пустое, а brand заполнен.
  const found = getNetworkIdentity(station("АЗС", [], { brand: "Башнефть" }))
  assert.equal(found?.label, "Башнефть")
})

test("метановая станция не носит цвет бензиновой сети", () => {
  /* «АГНКС Газпромтрансгаз Сургут» ловилась словом «газпром» и красилась
     синим Газпромнефти: водитель с газобаллонным оборудованием видел на
     карте бензиновую сеть там, где стоит метановая станция. */
  const gas = getStationIdentity(station("АГНКС Газпромтрансгазсургут", ["CNG"]))
  assert.equal(gas.shortLabel, "ГАЗ")
  assert.notEqual(gas.label, "Газпромнефть")
})

test("бензиновая Газпромнефть остаётся Газпромнефтью", () => {
  // Слово «газ» в названии сети не делает её газовой.
  const petrol = getStationIdentity(station("Газпромнефть", ["АИ-95", "ДТ"]))
  assert.equal(petrol.label, "Газпромнефть")
})

test("зарядка не притворяется сетью", () => {
  const charger = getStationIdentity(station("Зарядка Роснефть", ["EV"]))
  assert.equal(charger.shortLabel, "EV")
})

test("«Автодор» больше не перехватывается «Трассой»", () => {
  /* Правило «трасса м» стояло ниже «трасса» и не срабатывало никогда:
     подстрока перехватывала его на строку раньше. */
  assert.equal(getNetworkIdentity(station("АЗС Трасса М-4"))?.label, "Автодор")
  assert.equal(getNetworkIdentity(station("Трасса"))?.label, "Трасса")
})

test("«нефтегазсеть» опознаётся как NPS, а не как Нефтегаз", () => {
  assert.equal(getNetworkIdentity(station("Нефтегазсеть"))?.label, "NPS")
  assert.equal(getNetworkIdentity(station("Сибнефтегаз"))?.label, "Нефтегаз")
})

test("Сургутнефтегаз не путается с Нефтегазом", () => {
  assert.equal(getNetworkIdentity(station('ПАО "Сургутнефтегаз"'))?.label, "Сургутнефтегаз")
})

test("безымянная заправка получает нейтральный вид, а не чужой бренд", () => {
  const plain = getStationIdentity(station("АЗС", ["АИ-92"]))
  assert.equal(plain.shortLabel, "АЗС")
})

test("газовая по ассортименту, даже если в имени ничего нет", () => {
  // Бензин в ассортименте — заправка бензиновая, чем бы её ни назвали.
  assert.equal(getGenericIdentity(station("Заправка", ["LPG"])).shortLabel, "ГАЗ")
  assert.equal(getGenericIdentity(station("Заправка", ["LPG", "АИ-95"])).shortLabel, "АЗС")
})

test("пустой ассортимент: название — единственная подсказка", () => {
  /* У трёхсот с лишним точек ассортимент пуст, и «АГЗС» в имени
     единственное, по чему можно судить. Полное слово, а не подстрока. */
  assert.equal(getGenericIdentity(station("АГЗС на въезде", [])).shortLabel, "ГАЗ")
  assert.equal(getGenericIdentity(station("Газпромнефть", [])).shortLabel, "АЗС")
})

test("у каждой точки есть цвет и подпись", () => {
  // Значок рисуется всегда: карточка не должна остаться без него.
  for (const name of ["Лукойл", "АЗС", "АГЗС", "Зарядка", "Нечто безымянное"]) {
    const identity = getStationIdentity(station(name, []))
    assert.ok(identity.color.startsWith("#"), `нет цвета у «${name}»`)
    assert.ok(identity.shortLabel.length > 0, `нет подписи у «${name}»`)
    assert.ok(identity.label.length > 0, `нет названия у «${name}»`)
  }
})

test("ни одно правило сети не перекрыто более коротким", () => {
  /* Проверка порядка: правило, чья строка содержит более раннюю строку,
     не сработает никогда. Так молча умерли три правила. */
  const source = readFileSync(new URL("../src/lib/fuel-station-identity.ts", import.meta.url), "utf8")
  /* Правило может занимать несколько строк: слова внутри одного `if`
     перечислены через `||` и друг друга не перекрывают — любое из них
     даёт тот же ответ. Опасно, когда слово съедает правило выше. */
  const rules: string[] = []
  for (const line of source.split("\n")) {
    if (!line.includes("source.includes(")) continue
    if (line.trimStart().startsWith("||")) rules[rules.length - 1] += " " + line
    else rules.push(line)
  }

  const settled: Array<{ token: string; rule: number }> = []
  rules.forEach((rule, index) => {
    const tokens = [...rule.matchAll(/source\.includes\("([^"]+)"\)/g)].map((hit) => hit[1])
    for (const token of tokens) {
      const shadowing = settled.find((earlier) => earlier.rule !== index && token.includes(earlier.token))
      assert.equal(shadowing, undefined, `правило "${token}" перекрыто более ранним "${shadowing?.token}"`)
    }
    for (const token of tokens) settled.push({ token, rule: index })
  })

  assert.ok(settled.length > 40, "правил стало подозрительно мало")
})

