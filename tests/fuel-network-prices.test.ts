import { describe, expect, it } from "vitest"
import { buildNetworkPrices, type NetworkPriceSample } from "@/lib/fuel-network-prices"

/** Короткая запись пробы: пять точек сети — минимум, чтобы строка прошла. */
function samples(brand: string, prices: number[], name = brand): NetworkPriceSample[] {
  return prices.map((priceRub) => ({ name, brand, fuel: "AI95", priceRub }))
}

describe("buildNetworkPrices", () => {
  it("считает медиану по сети", () => {
    const rows = buildNetworkPrices(samples("Лукойл", [6_800, 6_900, 7_000, 7_100, 7_200]))
    expect(rows).toHaveLength(1)
    expect(rows[0].label).toBe("Лукойл")
    expect(rows[0].priceRub).toBe(7_000)
    expect(rows[0].stations).toBe(5)
  })

  it("склеивает разные написания одной сети", () => {
    /* В базе лежат и «Газпром нефть», и «Газпромнефть», и «Газпром» —
       водитель не должен видеть три строки об одной вывеске. */
    const rows = buildNetworkPrices([
      ...samples("Газпром нефть", [7_000, 7_100]),
      ...samples("Газпромнефть", [7_200, 7_300]),
      ...samples("Газпром", [7_400]),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].label).toBe("Газпромнефть")
    expect(rows[0].stations).toBe(5)
  })

  it("склеивает Лукойл в разных регистрах", () => {
    const rows = buildNetworkPrices([
      ...samples("Лукойл", [6_800, 6_900, 7_000]),
      ...samples("ЛУКОЙЛ", [7_100, 7_200]),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].stations).toBe(5)
  })

  it("устойчива к порченой цене — ради этого и медиана", () => {
    /* Среднее по этому набору дало бы 92 ₽ при настоящих 70. */
    const rows = buildNetworkPrices(samples("Лукойл", [6_900, 7_000, 7_000, 7_100, 19_500]))
    expect(rows[0].priceRub).toBe(7_000)
  })

  it("отбрасывает сеть, точек которой слишком мало", () => {
    /* «ОПТИ» с тремя точками давала в Уфе медиану 116 ₽ вместо 66 ₽. */
    expect(buildNetworkPrices(samples("Опти", [6_615, 11_600, 11_600]))).toEqual([])
  })

  it("не пускает в сводку безымянные заправки", () => {
    expect(buildNetworkPrices(
      samples("Независимая / Прочее", [6_800, 6_900, 7_000, 7_100, 7_200], "АЗС 24"),
    )).toEqual([])
  })

  it("не пускает сводную метку газовых заправок", () => {
    /* «Экогаз» и «Мосавтогаз» — разные сети под одной меткой, да и цена
       газа втрое ниже: строка встала бы первой и сломала сортировку. */
    expect(buildNetworkPrices([
      ...samples("Экогаз", [3_500, 3_600, 3_700]),
      ...samples("Мосавтогаз", [3_800, 3_900]),
    ])).toEqual([])
  })

  it("ставит дешёвую сеть первой", () => {
    const rows = buildNetworkPrices([
      ...samples("Лукойл", [7_000, 7_000, 7_000, 7_000, 7_000]),
      ...samples("Башнефть", [6_700, 6_700, 6_700, 6_700, 6_700]),
      ...samples("Татнефть", [6_800, 6_800, 6_800, 6_800, 6_800]),
    ])
    expect(rows.map((row) => row.label)).toEqual(["Башнефть", "Татнефть", "Лукойл"])
  })

  it("отдаёт фирменный цвет сети — по нему её узнают на карте", () => {
    const rows = buildNetworkPrices(samples("Лукойл", [7_000, 7_000, 7_000, 7_000, 7_000]))
    expect(rows[0].color).toBe("#d8202f")
    expect(rows[0].textColor).toBe("#fff")
  })

  it("при чётном числе точек не выдумывает несуществующую цену", () => {
    const rows = buildNetworkPrices(samples("Лукойл", [7_000, 7_000, 7_010, 7_020, 7_030, 7_040]))
    /* Полусумма середин дала бы 70,15 ₽ — такой цены на колонке нет. */
    expect(rows[0].priceRub).toBe(7_010)
  })

  it("возвращает пустую сводку, когда данных нет", () => {
    expect(buildNetworkPrices([])).toEqual([])
  })
})
