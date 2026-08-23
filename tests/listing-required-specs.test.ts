import assert from "node:assert/strict"
import test from "node:test"
import {
  describeMissingSpecs,
  describeRequiredSpecs,
  getMissingSpecs,
  getRequiredSpecs,
  validateRequiredSpecs,
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
} from "../src/lib/listing-required-specs.ts"

const fields = (input: Parameters<typeof getRequiredSpecs>[0]) => getRequiredSpecs(input).map((spec) => spec.field)
const common = ["color", "condition", "documentsStatus", "damageInfo", "sellerType", "availability", "customsCleared"]

test("легковой автомобиль требует данные уровня крупных классифайдов", () => {
  assert.deepEqual(fields({ vehicleType: "CAR" }), [
    "year", "mileage", "fuelType", "transmission", "engineVolume", "power",
    "bodyType", "driveType", "steeringWheel", "ownersCount", "generation", ...common,
  ])
})

test("мотоцикл и грузовик получают подходящие обязательные поля", () => {
  assert.deepEqual(fields({ vehicleType: "MOTORCYCLE" }), [
    "year", "mileage", "fuelType", "transmission", "engineVolume", "power", "ownersCount", ...common,
  ])
  assert.deepEqual(fields({ vehicleType: "TRUCK" }), [
    "year", "mileage", "fuelType", "transmission", "engineVolume", "power", "steeringWheel", "ownersCount", ...common,
  ])
})

test("спецтехника, вода и авиация используют свой счётчик", () => {
  const special = fields({ vehicleType: "SPECIAL" })
  assert.ok(special.includes("operatingHours"))
  assert.equal(special.includes("mileage"), false)
  assert.equal(special.includes("transmission"), false)
  const water = fields({ vehicleType: "WATER" })
  assert.ok(water.includes("operatingHours"))
  assert.equal(water.includes("mileage"), false)
  const air = fields({ vehicleType: "AIR" })
  assert.ok(air.includes("flightHours"))
  assert.ok(air.includes("power"))
  assert.equal(air.includes("engineVolume"), false)
})

test("электромобилю не нужны литры, но мощность нужна", () => {
  const specs = fields({ vehicleType: "CAR", fuelType: "ELECTRIC" })
  assert.equal(specs.includes("engineVolume"), false)
  assert.equal(specs.includes("power"), true)
})

test("для ДВС обязательны и объём, и мощность", () => {
  const specs = fields({ vehicleType: "CAR", fuelType: "GASOLINE" })
  assert.equal(specs.includes("engineVolume"), true)
  assert.equal(specs.includes("power"), true)
})

test("у прицепа нет вымышленных силовых характеристик", () => {
  for (const subtype of ["TANKER", "CONTAINER"]) {
    const specs = fields({ vehicleType: "TRUCK", subtype })
    for (const field of ["mileage", "fuelType", "transmission", "engineVolume", "power"] as const) assert.equal(specs.includes(field), false)
    assert.ok(specs.includes("documentsStatus"))
  }
})

test("у планера нет топлива, объёма и мощности", () => {
  const specs = fields({ vehicleType: "AIR", subtype: "GLIDER" })
  for (const field of ["fuelType", "engineVolume", "power"] as const) assert.equal(specs.includes(field), false)
})

test("неизвестный вид транспорта получает строгие правила легкового", () => {
  assert.deepEqual(fields({ vehicleType: "UNKNOWN" }), fields({ vehicleType: "CAR" }))
  assert.deepEqual(fields({}), fields({ vehicleType: "CAR" }))
})

const completeCar = {
  vehicleType: "CAR", year: 2022, mileage: 0, fuelType: "GASOLINE", transmission: "AUTOMATIC",
  engineVolume: 1.6, power: 150, bodyType: "SEDAN", driveType: "FWD", steeringWheel: "LEFT",
  ownersCount: 0, generation: "VII", color: "Белый", condition: "EXCELLENT", documentsStatus: "CLEAN",
  damageInfo: "NONE", sellerType: "OWNER", availability: "IN_STOCK", customsCleared: true,
}

test("полностью заполненная машина проходит, нулевой пробег и 0 владельцев допустимы", () => {
  assert.equal(validateRequiredSpecs(completeCar), null)
})

test("нулевые объём и мощность не считаются заполненными", () => {
  const missing = getMissingSpecs({ ...completeCar, engineVolume: 0, power: 0 })
  assert.deepEqual(missing.map((spec) => spec.field), ["engineVolume", "power"])
})

test("ошибка называет только недостающие поля", () => {
  const message = validateRequiredSpecs({ ...completeCar, mileage: null, documentsStatus: "" })
  assert.ok(message?.includes("Пробег"))
  assert.ok(message?.includes("Статус документов"))
  assert.equal(message?.includes("Год выпуска"), false)
})

test("единица измерения попадает в текст ошибки", () => {
  assert.ok(describeMissingSpecs(getMissingSpecs({ vehicleType: "SPECIAL", year: 2015 }))?.includes("м/ч"))
})

test("пустой список сообщения не даёт", () => {
  assert.equal(describeMissingSpecs([]), null)
})

test("подсказка до заполнения соответствует категории", () => {
  assert.ok(describeRequiredSpecs("CAR").includes("коробка передач"))
  assert.ok(describeRequiredSpecs("SPECIAL").includes("наработка"))
  assert.equal(describeRequiredSpecs("SPECIAL").includes("коробка передач"), false)
  assert.ok(describeRequiredSpecs("AIR").includes("налёт"))
})
