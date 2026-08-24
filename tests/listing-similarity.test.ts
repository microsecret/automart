import assert from "node:assert/strict"
import test from "node:test"
import {
  rankSimilarVehicles,
  scoreVehicleSimilarity,
  type VehicleSimilarityCandidate,
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
} from "../src/lib/listing-similarity.ts"

const target: VehicleSimilarityCandidate = {
  id: "target",
  vehicleType: "CAR",
  make: "Toyota",
  model: "Camry",
  generation: "XV70",
  bodyType: "SEDAN",
  year: 2021,
  price: 2_500_000,
  fuelType: "GASOLINE",
  transmission: "AUTOMATIC",
  driveType: "FWD",
}

function candidate(overrides: Partial<VehicleSimilarityCandidate>): VehicleSimilarityCandidate {
  return { ...target, id: "candidate", ...overrides }
}

test("точная модель важнее одной близкой цены", () => {
  const exactModel = candidate({ id: "exact", year: 2020, price: 2_750_000 })
  const otherMake = candidate({ id: "other", make: "Hyundai", model: "Sonata", generation: null, price: 2_500_000 })

  assert.ok(scoreVehicleSimilarity(target, exactModel) > scoreVehicleSimilarity(target, otherMake))
  assert.equal(rankSimilarVehicles(target, [otherMake, exactModel])[0]?.id, "exact")
})

test("другая марка остаётся альтернативой при совпадении класса и характеристик", () => {
  const alternative = candidate({ id: "alternative", make: "Kia", model: "K5", generation: null, price: 2_450_000 })

  assert.deepEqual(rankSimilarVehicles(target, [alternative]).map((item) => item.id), ["alternative"])
})

test("виды транспорта никогда не смешиваются", () => {
  const truck = candidate({ id: "truck", vehicleType: "TRUCK" })
  const car = candidate({ id: "car", make: "Skoda", model: "Superb" })

  assert.deepEqual(rankSimilarVehicles(target, [truck, car]).map((item) => item.id), ["car"])
})

test("результат ограничен и стабилен при равной оценке", () => {
  const first = candidate({ id: "first", make: "Mazda", model: "6" })
  const second = candidate({ id: "second", make: "Honda", model: "Accord" })
  const third = candidate({ id: "third", make: "Kia", model: "K5" })

  assert.deepEqual(rankSimilarVehicles(target, [first, second, third], 2).map((item) => item.id), ["first", "second"])
  assert.deepEqual(rankSimilarVehicles(target, [first], 0), [])
})
