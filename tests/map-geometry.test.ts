import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { TILE_SIZE, coordinatesToWorld, getDistanceInKilometers, worldToCoordinates } from "../src/lib/map-geometry.ts"

test("центр карты приходится на середину мировой сетки", () => {
  // Нулевая широта и долгота — центр проекции Меркатора.
  const world = coordinatesToWorld(0, 0, 0)
  assert.equal(Math.round(world.x), TILE_SIZE / 2)
  assert.equal(Math.round(world.y), TILE_SIZE / 2)
})

test("перевод туда и обратно возвращает те же координаты", () => {
  /* Ошибка здесь не ломает страницу, а тихо сдвигает все метки: глазами
     это почти не заметно, поэтому проверяем числами. */
  for (const [latitude, longitude] of [
    [55.7558, 37.6173], // Москва
    [54.7388, 55.9721], // Уфа
    [43.6028, 39.7342], // Сочи
    [58.0105, 56.2502], // Пермь
  ]) {
    const world = coordinatesToWorld(latitude, longitude, 12)
    const back = worldToCoordinates(world.x, world.y, 12)
    assert.ok(Math.abs(back.latitude - latitude) < 1e-9, `широта разошлась: ${latitude}`)
    assert.ok(Math.abs(back.longitude - longitude) < 1e-9, `долгота разошлась: ${longitude}`)
  }
})

test("север выше юга, восток правее запада", () => {
  // Перепутанный знак развернул бы карту, а тесты на равенство этого не ловят.
  const north = coordinatesToWorld(60, 30, 10)
  const south = coordinatesToWorld(50, 30, 10)
  assert.ok(north.y < south.y, "север оказался ниже юга")

  const east = coordinatesToWorld(55, 40, 10)
  const west = coordinatesToWorld(55, 30, 10)
  assert.ok(east.x > west.x, "восток оказался левее запада")
})

test("увеличение удваивает сетку", () => {
  // Каждый шаг зума — вдвое больше плиток по стороне.
  const near = coordinatesToWorld(55, 37, 10)
  const far = coordinatesToWorld(55, 37, 11)
  assert.ok(Math.abs(far.x - near.x * 2) < 1e-6)
  assert.ok(Math.abs(far.y - near.y * 2) < 1e-6)
})

test("карту можно тянуть вбок бесконечно", () => {
  /* Долгота заворачивается по кругу: на пятом обороте вправо человек
     должен видеть то же место, а не пустоту. */
  const worldSize = TILE_SIZE * (2 ** 10)
  const here = worldToCoordinates(1000, 500, 10)
  const afterLaps = worldToCoordinates(1000 + worldSize * 5, 500, 10)
  assert.ok(Math.abs(here.longitude - afterLaps.longitude) < 1e-9)
})

test("за полюс карта не уезжает", () => {
  // Широта ограничена: за полюсом карты нет и тянуть туда бессмысленно.
  const top = worldToCoordinates(500, -10_000, 10)
  const bottom = worldToCoordinates(500, 10_000_000, 10)
  assert.ok(top.latitude > 80 && top.latitude < 90)
  assert.ok(bottom.latitude < -80 && bottom.latitude > -90)
})

test("расстояние считается по поверхности Земли", () => {
  /* Москва — Санкт-Петербург, по прямой около 635 км. Плоская геометрия
     на таком расстоянии ошибается заметно, а человек читает «1,2 км»
     как обещание. */
  const moscow = { latitude: 55.7558, longitude: 37.6173 }
  const spb = { latitude: 59.9311, longitude: 30.3609 }
  const km = getDistanceInKilometers(moscow, spb)
  assert.ok(km > 620 && km < 650, `получилось ${km.toFixed(1)} км`)
})

test("расстояние до себя равно нулю и не зависит от направления", () => {
  const a = { latitude: 54.7388, longitude: 55.9721 }
  const b = { latitude: 54.7500, longitude: 55.9800 }
  assert.equal(getDistanceInKilometers(a, a), 0)
  assert.ok(Math.abs(getDistanceInKilometers(a, b) - getDistanceInKilometers(b, a)) < 1e-12)
})

test("соседние улицы — сотни метров, а не километры", () => {
  // На городской карте человек сверяет «1,2 км» с тем, что видит.
  const near = getDistanceInKilometers(
    { latitude: 54.7388, longitude: 55.9721 },
    { latitude: 54.7420, longitude: 55.9760 },
  )
  assert.ok(near > 0.3 && near < 0.6, `получилось ${near.toFixed(3)} км`)
})
