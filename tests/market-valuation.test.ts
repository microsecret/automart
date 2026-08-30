import test from "node:test"
import assert from "node:assert/strict"

// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { adjustToSubject, selectComparables, valuateFromMarket } from "../src/lib/market-valuation.ts"

/** Ряд похожих лотов: одна модель, один год, близкие цены. */
function sameModelListings(count: number, priceRub: number) {
  return Array.from({ length: count }, (_, index) => ({
    make: "Kia",
    model: "K5",
    year: 2020,
    mileage: 60_000,
    /* Небольшой разброс: настоящий рынок никогда не даёт одно число. */
    priceRub: priceRub + index * 20_000,
  }))
}

test("оценка идёт от рынка, а не от цены продавца", () => {
  /* Прежняя оценка брала цену, которую продавец сам же и указал, и
     умножала её на коэффициенты — всегда возвращая меньше введённого.
     Здесь цена продавца не участвует вовсе. */
  const result = valuateFromMarket(
    sameModelListings(10, 2_000_000),
    { make: "Kia", model: "K5", year: 2020, mileage: 60_000 },
  )

  assert.ok(result)
  /* Медиана ряда 2,00–2,18 млн лежит внутри него. */
  assert.ok(result.estimatedValue > 2_000_000 && result.estimatedValue < 2_200_000, `получено ${result.estimatedValue}`)
  assert.equal(result.matchLevel, "model")
  assert.equal(result.sampleSize, 10)
})

test("сравнивать не с чем — честно возвращаем ничего", () => {
  /* Выдуманное число хуже отсутствия: человек примет его за оценку и
     будет торговаться по нему. */
  const result = valuateFromMarket(
    [{ make: "Kia", model: "K5", year: 2020, mileage: 60_000, priceRub: 2_000_000 }],
    { make: "Tesla", model: "Model 3", year: 2023, mileage: 10_000 },
  )
  assert.equal(result, null)
})

test("машина новее сопоставимой стоит дороже", () => {
  const older = { make: "Kia", model: "K5", year: 2018, mileage: 60_000, priceRub: 1_000_000 }
  const adjusted = adjustToSubject(older, { make: "Kia", model: "K5", year: 2022, mileage: 60_000 })
  assert.ok(adjusted > 1_000_000, `ожидали дороже миллиона, получили ${adjusted}`)
})

test("больший пробег снижает цену", () => {
  const listing = { make: "Kia", model: "K5", year: 2020, mileage: 20_000, priceRub: 2_000_000 }
  const adjusted = adjustToSubject(listing, { make: "Kia", model: "K5", year: 2020, mileage: 220_000 })
  assert.ok(adjusted < 2_000_000, `ожидали дешевле, получили ${adjusted}`)
  /* Но не в ноль: машина стоит хотя бы как железо. */
  assert.ok(adjusted > 2_000_000 * 0.2)
})

test("выброс не утаскивает оценку за собой", () => {
  /* В аукционных данных попадаются битые машины по цене металлолома и
     единичные экземпляры втрое дороже рынка. Среднее они утаскивают,
     медиана — нет. */
  const listings = [
    ...sameModelListings(9, 2_000_000),
    { make: "Kia", model: "K5", year: 2020, mileage: 60_000, priceRub: 25_000_000 },
  ]
  const result = valuateFromMarket(listings, { make: "Kia", model: "K5", year: 2020, mileage: 60_000 })
  assert.ok(result)
  assert.ok(result.estimatedValue < 2_500_000, `выброс сдвинул оценку: ${result.estimatedValue}`)
})

test("круг сравнения расширяется, когда точных совпадений мало", () => {
  /* Одна машина той же модели — не выборка. Марка целиком всё ещё
     говорит о цене больше, чем ничего. */
  const listings = [
    { make: "Kia", model: "K5", year: 2020, mileage: 60_000, priceRub: 2_000_000 },
    { make: "Kia", model: "Sportage", year: 2020, mileage: 55_000, priceRub: 2_300_000 },
    { make: "Kia", model: "Rio", year: 2021, mileage: 30_000, priceRub: 1_400_000 },
    { make: "Kia", model: "Ceed", year: 2019, mileage: 80_000, priceRub: 1_600_000 },
  ]
  const { matchLevel } = selectComparables(listings, { make: "Kia", model: "K5", year: 2020, mileage: 60_000 })
  assert.equal(matchLevel, "make")
})

test("уверенность падает, когда выборка широкая или разбросанная", () => {
  const tight = valuateFromMarket(
    sameModelListings(20, 2_000_000),
    { make: "Kia", model: "K5", year: 2020, mileage: 60_000 },
  )
  /* Тот же размер выборки, но цены разлетаются в разы. */
  const loose = valuateFromMarket(
    Array.from({ length: 20 }, (_, index) => ({
      make: "Kia",
      model: "K5",
      year: 2020,
      mileage: 60_000,
      priceRub: 500_000 + index * 400_000,
    })),
    { make: "Kia", model: "K5", year: 2020, mileage: 60_000 },
  )

  assert.ok(tight && loose)
  assert.ok(
    tight.confidencePercent > loose.confidencePercent,
    `плотный ряд ${tight.confidencePercent}% должен быть увереннее разбросанного ${loose.confidencePercent}%`,
  )
})

test("модель узнаётся, даже когда в названии лишнее", () => {
  /* Источники пишут «MODEL 3 2023», «Model 3», «MODEL3» — это одна
     машина, и разводить их по разным выборкам нельзя. */
  const listings = Array.from({ length: 5 }, (_, index) => ({
    make: "Tesla",
    model: index % 2 === 0 ? "MODEL 3 2023" : "Model 3",
    year: 2022,
    mileage: 30_000,
    priceRub: 1_600_000 + index * 10_000,
  }))
  const { matchLevel, comparables } = selectComparables(listings, { make: "Tesla", model: "Model 3", year: 2022, mileage: 30_000 })
  assert.equal(matchLevel, "model")
  assert.equal(comparables.length, 5)
})

test("коридор торга берётся из ряда, а не процентом от медианы", () => {
  /* Плюс-минус двенадцать процентов выглядели одинаково уверенно и на
     плотном ряду, и на разбросанном, хотя это разные ситуации. */
  const result = valuateFromMarket(
    sameModelListings(12, 2_000_000),
    { make: "Kia", model: "K5", year: 2020, mileage: 60_000 },
  )
  assert.ok(result)
  assert.ok(result.min <= result.estimatedValue && result.estimatedValue <= result.max)
  assert.ok(result.max - result.min < result.estimatedValue, "коридор шире самой оценки — что-то не так")
})
