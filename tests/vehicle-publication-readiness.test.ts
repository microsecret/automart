import assert from "node:assert/strict"
import test from "node:test"
import {
  getMissingVehiclePublicationRequirements,
  normalizeVehicleIdentity,
  readStoredVehicleSubtype,
  validateVehiclePublication,
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
} from "../src/lib/vehicle-publication-readiness.ts"

const completeCar = {
  vehicleType: "CAR", make: "Toyota", model: "Camry", year: 2022, price: 2_850_000,
  location: "Екатеринбург", vin: "JTNB11HK0N3000001", mileage: 42_000, fuelType: "GASOLINE",
  transmission: "AUTOMATIC", engineVolume: 2.5, power: 181, bodyType: "SEDAN", driveType: "FWD",
  color: "Белый", condition: "EXCELLENT", steeringWheel: "LEFT", ownersCount: 1,
  documentsStatus: "CLEAN", damageInfo: "NONE", sellerType: "OWNER", availability: "IN_STOCK",
  customsCleared: true, generation: "VIII (XV70)",
  description: "Автомобиль в отличном состоянии, своевременное обслуживание у дилера.",
  images: ["/uploads/car.webp"],
}

test("полная карточка допускается к модерации", () => {
  assert.equal(validateVehiclePublication(completeCar), null)
})

test("неполная карточка перечисляет отсутствующие данные", () => {
  const missing = getMissingVehiclePublicationRequirements({ ...completeCar, power: null, documentsStatus: null, images: [] })
  assert.deepEqual(missing.map((item) => item.field), ["power", "documentsStatus", "images"])
})

test("короткое описание и нулевая цена блокируют публикацию", () => {
  const missing = getMissingVehiclePublicationRequirements({ ...completeCar, price: 0, description: "Коротко" })
  assert.ok(missing.some((item) => item.field === "price"))
  assert.ok(missing.some((item) => item.field === "description"))
})

test("false является выбранным таможенным статусом", () => {
  assert.equal(validateVehiclePublication({ ...completeCar, customsCleared: false }), null)
})

test("мусор в перечислении и VIN отклоняется", () => {
  assert.match(validateVehiclePublication({ ...completeCar, condition: "SUPER" }) || "", /состояние/i)
  assert.match(validateVehiclePublication({ ...completeCar, vin: "INVALIDVIN0000000" }) || "", /VIN/i)
})

test("форма, гараж и API используют одну нормализацию VIN", () => {
  assert.deepEqual(normalizeVehicleIdentity("CAR", " jtnb11hk0n3000001 ", null, null), {
    vin: "JTNB11HK0N3000001",
    serialNumber: null,
    registrationNumber: null,
  })
  const invalid = normalizeVehicleIdentity("CAR", "INVALID", null, null)
  assert.match("error" in invalid ? invalid.error : "", /VIN/i)
})

test("подтип безопасно извлекается из сохранённого JSON", () => {
  assert.equal(readStoredVehicleSubtype("TRUCK", '{"truckBodyType":"TANKER"}'), "TANKER")
  assert.equal(readStoredVehicleSubtype("TRUCK", "not-json"), "")
  assert.equal(readStoredVehicleSubtype("CAR", '{"truckBodyType":"TANKER"}'), "")
})
