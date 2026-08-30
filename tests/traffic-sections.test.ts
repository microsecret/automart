import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { readablePath, sectionForPath } from "../src/lib/traffic-sections.ts"

test("карточка машины отличается от подачи объявления", () => {
  /* Порядок правил значим: «/listings» перехватил бы «/listings/create»
     и подача попала бы в просмотры каталога. */
  assert.equal(sectionForPath("/listings/create/vehicle").key, "create-vehicle")
  assert.equal(sectionForPath("/listings/vehicle/abc-123").key, "vehicle")
  assert.equal(sectionForPath("/listings/create/part").key, "create-part")
  assert.equal(sectionForPath("/listings/part/abc-123").key, "part")
})

test("сервисы разделены по названиям", () => {
  // Владелец смотрит, окупается ли карта заправок отдельно от прочего.
  assert.equal(sectionForPath("/services/fuel-map").key, "fuel-map")
  assert.equal(sectionForPath("/services/valuation").key, "valuation")
  assert.equal(sectionForPath("/services/legal-documents").key, "services")
})

test("главная и поиск — один раздел каталога", () => {
  // Человек ищет машину и там, и там: разделять их незачем.
  assert.equal(sectionForPath("/").key, "catalog")
  assert.equal(sectionForPath("/search?make=Toyota").key, "catalog")
  assert.equal(sectionForPath("/category/legkovye").key, "catalog")
})

test("параметры адреса не мешают опознанию", () => {
  // Фильтры каталога дописывают к пути хвост, и раздел от этого не меняется.
  assert.equal(sectionForPath("/services/fuel-map?from=telegram").key, "fuel-map")
  assert.equal(sectionForPath("/forum/o-ploshchadke#post-1").key, "forum")
})

test("незнакомый адрес не роняет разбор", () => {
  assert.equal(sectionForPath("/что-то-новое").key, "other")
  assert.equal(sectionForPath("").key, "catalog")
})

test("адрес с кодом объявления заменяется на понятное имя", () => {
  /* «/listings/vehicle/1f020612-75f5-4167-8421-adb22f9770c9» владелец не
     узнаёт: он не помнит машины по коду, а сорок таких строк вытесняют
     из отчёта всё остальное. */
  assert.equal(readablePath("/listings/vehicle/1f020612-75f5-4167-8421-adb22f9770c9"), "Карточка машины")
  assert.equal(readablePath("/auctions/c7351441-a3a6-490a-8da8-59837729a69c"), "Аукционы")
})

test("короткий адрес остаётся как есть", () => {
  // Его владелец узнаёт с одного взгляда.
  assert.equal(readablePath("/parts-finder"), "/parts-finder")
  assert.equal(readablePath("/services/fuel-map"), "/services/fuel-map")
  assert.equal(readablePath("/"), "Главная")
})

test("каждый раздел принадлежит группе", () => {
  // Группа нужна для сводки «чем занимались», а не «что открыли».
  for (const path of ["/", "/parts-finder", "/auctions", "/services/fuel-map", "/forum", "/dashboard", "/что-то"]) {
    const section = sectionForPath(path)
    assert.ok(section.group.length > 0, `нет группы у ${path}`)
    assert.ok(section.label.length > 0, `нет названия у ${path}`)
  }
})
