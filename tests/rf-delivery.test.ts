import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { estimateRfDelivery, isKnownDeliveryPrice, KNOWN_DELIVERY_PRICES } from "../src/lib/rf-delivery.ts"

test("известные цены перевозчиков возвращаются как есть", () => {
  // Это факт из тарифов, а не расчёт: формула не должна их переписывать.
  for (const [city, price] of Object.entries(KNOWN_DELIVERY_PRICES)) {
    assert.equal(estimateRfDelivery(city), price, city)
  }
})

test("доставка во Владивосток бесплатна — машина уже там", () => {
  assert.equal(estimateRfDelivery("Владивосток"), 0)
})

test("близкий город стоит дешевле далёкого", () => {
  // Раньше обоим подставлялось 180 000 ₽ — столько же, сколько до Москвы.
  const blagoveshchensk = estimateRfDelivery("Благовещенск")
  const kaliningrad = estimateRfDelivery("Калининград")
  assert.ok(blagoveshchensk < kaliningrad, `${blagoveshchensk} должно быть меньше ${kaliningrad}`)
})

test("расчёт для города рядом с известным близок к его цене", () => {
  // Комсомольск-на-Амуре недалеко от Хабаровска (25 000 ₽): расчёт не должен
  // давать московскую цену.
  const komsomolsk = estimateRfDelivery("Комсомольск-на-Амуре")
  assert.ok(komsomolsk < 90_000, `получено ${komsomolsk} — слишком дорого для соседа Хабаровска`)
})

test("расчёт для города рядом с Москвой близок к московской цене", () => {
  const tver = estimateRfDelivery("Тверь")
  assert.ok(Math.abs(tver - 180_000) < 40_000, `получено ${tver}`)
})

test("неизвестный город получает прежнее значение по умолчанию", () => {
  assert.equal(estimateRfDelivery("Урюпинск-на-Луне"), 180_000)
  assert.equal(estimateRfDelivery(null), 180_000)
  assert.equal(estimateRfDelivery(""), 180_000)
})

test("цена округлена до пяти тысяч — точность здесь ложная", () => {
  const price = estimateRfDelivery("Пермь")
  assert.equal(price % 5_000, 0, `получено ${price}`)
})

test("видно, откуда взялась цена — тариф или расчёт", () => {
  assert.equal(isKnownDeliveryPrice("Москва"), true)
  assert.equal(isKnownDeliveryPrice("Пермь"), false)
  assert.equal(isKnownDeliveryPrice(null), false)
})

test("цена всегда положительна и не абсурдна", () => {
  for (const city of ["Мурманск", "Калининград", "Магадан", "Сочи", "Тюмень"]) {
    const price = estimateRfDelivery(city)
    assert.ok(price >= 0, `${city}: ${price}`)
    assert.ok(price < 400_000, `${city}: ${price} — неправдоподобно дорого`)
  }
})
