import { describe, expect, it } from "vitest"
import {
  hasConsistentOctaneOrder,
  isPlausiblePrice,
  sanitizeStationPrices,
} from "@/lib/fuel-price-sanity"

/* Все числа ниже взяты из боевой базы 16 сентября 2026, а не придуманы:
   так тест проверяет ровно те случаи, ради которых отсев написан. */

describe("isPlausiblePrice", () => {
  it("пропускает обычные цены", () => {
    expect(isPlausiblePrice("AI95", 7_320)).toBe(true)
    expect(isPlausiblePrice("AI92", 6_750)).toBe(true)
    expect(isPlausiblePrice("DT", 8_060)).toBe(true)
    expect(isPlausiblePrice("GAS", 3_600)).toBe(true)
  })

  it("пропускает дешёвые регионы — пол не должен их отсекать", () => {
    /* Первый процентиль базы: АИ-92 по 60 ₽ и газ по 28 ₽ существуют. */
    expect(isPlausiblePrice("AI92", 6_000)).toBe(true)
    expect(isPlausiblePrice("GAS", 2_798)).toBe(true)
  })

  it("отбрасывает цену АИ-95 в 195 рублей из Тюмени", () => {
    expect(isPlausiblePrice("AI95", 19_500)).toBe(false)
  })

  it("отбрасывает АИ-92 за 229 рублей — максимум базы", () => {
    expect(isPlausiblePrice("AI92", 22_900)).toBe(false)
  })

  it("оставляет место дорогим районам вроде Камчатки", () => {
    /* Сотый за 130 ₽ на Дальнем Востоке — дорого, но правда. */
    expect(isPlausiblePrice("AI100", 13_000)).toBe(true)
  })

  it("не выбрасывает незнакомую марку", () => {
    expect(isPlausiblePrice("AI80", 5_000)).toBe(true)
  })

  it("отбрасывает нечисловое и отрицательное", () => {
    expect(isPlausiblePrice("AI95", Number.NaN)).toBe(false)
    expect(isPlausiblePrice("AI80", -100)).toBe(false)
  })
})

describe("hasConsistentOctaneOrder", () => {
  it("принимает нормальный порядок", () => {
    expect(hasConsistentOctaneOrder([
      { fuel: "AI92", priceRub: 6_750 },
      { fuel: "AI95", priceRub: 7_320 },
      { fuel: "AI100", priceRub: 9_849 },
    ])).toBe(true)
  })

  it("ловит перевёрнутую станцию «Иликом» из Казани", () => {
    /* АИ-100 за 110 ₽ при АИ-92 за 129 ₽ — так не бывает. */
    expect(hasConsistentOctaneOrder([
      { fuel: "AI100", priceRub: 11_000 },
      { fuel: "AI92", priceRub: 12_900 },
      { fuel: "AI95", priceRub: 13_900 },
    ])).toBe(false)
  })

  it("допускает равные цены — это бывает по акции", () => {
    expect(hasConsistentOctaneOrder([
      { fuel: "AI92", priceRub: 6_750 },
      { fuel: "AI95", priceRub: 6_750 },
    ])).toBe(true)
  })

  it("не спотыкается на пропуске в середине ряда", () => {
    expect(hasConsistentOctaneOrder([
      { fuel: "AI92", priceRub: 6_750 },
      { fuel: "AI100", priceRub: 9_800 },
    ])).toBe(true)
  })

  it("не судит станцию по одной марке", () => {
    expect(hasConsistentOctaneOrder([{ fuel: "AI95", priceRub: 7_320 }])).toBe(true)
    expect(hasConsistentOctaneOrder([])).toBe(true)
  })

  it("не сравнивает дизель и газ с бензином", () => {
    /* Дизель дешевле АИ-92 зимой и дороже летом — это не ошибка. */
    expect(hasConsistentOctaneOrder([
      { fuel: "DT", priceRub: 8_060 },
      { fuel: "AI92", priceRub: 6_750 },
      { fuel: "AI95", priceRub: 7_320 },
    ])).toBe(true)
    /* Газ втрое дешевле — и это тоже норма. */
    expect(hasConsistentOctaneOrder([
      { fuel: "GAS", priceRub: 3_600 },
      { fuel: "AI92", priceRub: 6_750 },
    ])).toBe(true)
  })
})

describe("sanitizeStationPrices", () => {
  it("оставляет честную станцию нетронутой", () => {
    const prices = [
      { fuel: "AI92", priceRub: 6_750 },
      { fuel: "AI95", priceRub: 7_320 },
      { fuel: "DT", priceRub: 8_060 },
    ]
    expect(sanitizeStationPrices(prices)).toEqual(prices)
  })

  it("выбрасывает станцию «Иликом» целиком", () => {
    expect(sanitizeStationPrices([
      { fuel: "AI100", priceRub: 11_000 },
      { fuel: "AI92", priceRub: 12_900 },
      { fuel: "AI95", priceRub: 13_900 },
      { fuel: "DT", priceRub: 13_900 },
    ])).toEqual([])
  })

  it("снимает одиночный выброс, не трогая остальное", () => {
    /* Коридор убирает 195 ₽ за АИ-95, а порядок оставшихся марок цел. */
    expect(sanitizeStationPrices([
      { fuel: "AI92", priceRub: 6_750 },
      { fuel: "AI95", priceRub: 19_500 },
      { fuel: "DT", priceRub: 8_060 },
    ])).toEqual([
      { fuel: "AI92", priceRub: 6_750 },
      { fuel: "DT", priceRub: 8_060 },
    ])
  })

  it("сохраняет лишние поля записи", () => {
    const prices = [{ fuel: "AI95", priceRub: 7_320, confirmations: 3, observedAt: null }]
    expect(sanitizeStationPrices(prices)).toEqual(prices)
  })

  it("возвращает пустой список, когда верить нечему", () => {
    expect(sanitizeStationPrices([{ fuel: "AI95", priceRub: 19_500 }])).toEqual([])
    expect(sanitizeStationPrices([])).toEqual([])
  })

  it("не роняет станцию из-за выброса, ломавшего порядок марок", () => {
    /* Тонкий случай: сырой АИ-92 за 129 ₽ переворачивает ряд, но его же
       снимает коридор — и оставшиеся марки честны. Если бы порядок
       проверялся до коридора, станция потеряла бы годные цены. */
    expect(sanitizeStationPrices([
      { fuel: "AI92", priceRub: 12_900 },
      { fuel: "AI95", priceRub: 7_320 },
      { fuel: "AI100", priceRub: 9_800 },
    ])).toEqual([
      { fuel: "AI95", priceRub: 7_320 },
      { fuel: "AI100", priceRub: 9_800 },
    ])
  })
})
