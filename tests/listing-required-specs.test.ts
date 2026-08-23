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

/**
 * Объявления публиковались без главных характеристик: в карточке стояли год
 * и цена, а пробег, коробка и двигатель были прочерками. Покупатель по такому
 * объявлению решение не принимает.
 *
 * Здесь проверяется, что набор обязательных полей соответствует именно той
 * технике, которую подают: требовать коробку у прицепа или литры у
 * электромобиля значит загнать продавца в тупик.
 */

const fields = (input: Parameters<typeof getRequiredSpecs>[0]) =>
  getRequiredSpecs(input).map((spec) => spec.field)

test("легковой автомобиль требует год, пробег, топливо, коробку и объём", () => {
  assert.deepEqual(fields({ vehicleType: "CAR" }), [
    "year",
    "mileage",
    "fuelType",
    "transmission",
    "engineVolume",
  ])
})

test("мотоцикл требует тот же набор, что и легковой", () => {
  // Коробка у мотоцикла есть, а топливо «почти всегда бензин» — не повод
  // подставлять его молча: электромотоциклы на площадке уже есть.
  assert.deepEqual(fields({ vehicleType: "MOTORCYCLE" }), [
    "year",
    "mileage",
    "fuelType",
    "transmission",
    "engineVolume",
  ])
})

test("грузовик требует полный набор дорожной техники", () => {
  assert.deepEqual(fields({ vehicleType: "TRUCK" }), [
    "year",
    "mileage",
    "fuelType",
    "transmission",
    "engineVolume",
  ])
})

test("спецтехника считает моточасы вместо пробега и не имеет коробки", () => {
  // Одометра у экскаватора нет, ресурс меряется наработкой; коробка в
  // карточке спецтехники не показывается и спрашивать её незачем.
  const specs = fields({ vehicleType: "SPECIAL" })
  assert.deepEqual(specs, ["year", "operatingHours", "fuelType", "engineVolume"])
  assert.equal(specs.includes("mileage"), false)
  assert.equal(specs.includes("transmission"), false)
})

test("катер считает моточасы, а не километры", () => {
  const specs = fields({ vehicleType: "WATER" })
  assert.deepEqual(specs, ["year", "operatingHours", "fuelType", "engineVolume"])
})

test("воздушное судно считает налёт и мощность вместо литров", () => {
  // Самолёт описывается типом двигателя и мощностью: объём в литрах о нём
  // ничего не сообщает, и требовать его — заставлять выдумывать число.
  const specs = fields({ vehicleType: "AIR" })
  assert.deepEqual(specs, ["year", "flightHours", "fuelType", "power"])
  assert.equal(specs.includes("engineVolume"), false)
})

test("у электромобиля вместо объёма двигателя спрашивают мощность", () => {
  // Литров у электротяги нет. Но покупателю всё равно нужен ответ на вопрос
  // «что там за мотор» — его даёт мощность.
  const specs = fields({ vehicleType: "CAR", fuelType: "ELECTRIC" })
  assert.equal(specs.includes("engineVolume"), false)
  assert.equal(specs.includes("power"), true)
  assert.equal(specs.includes("transmission"), true, "коробка у электромобиля остаётся")
})

test("бензиновый автомобиль мощность не обязан указывать", () => {
  // Мощность — замена объёму, а не дополнительное поле: два обязательных
  // поля вместо одного удлиняют форму без пользы.
  const specs = fields({ vehicleType: "CAR", fuelType: "GASOLINE" })
  assert.equal(specs.includes("power"), false)
  assert.equal(specs.includes("engineVolume"), true)
})

test("у прицепа не спрашивают ни двигатель, ни коробку, ни пробег", () => {
  // Полуприцеп-цистерна подаётся в разделе грузовиков, но это буксируемая
  // техника: одометра и мотора у неё нет физически.
  const specs = fields({ vehicleType: "TRUCK", subtype: "TANKER" })
  assert.deepEqual(specs, ["year"])
})

test("контейнеровоз-полуприцеп тоже освобождён от силовых полей", () => {
  assert.deepEqual(fields({ vehicleType: "TRUCK", subtype: "CONTAINER" }), ["year"])
})

test("тент и фургон обязательности не теряют", () => {
  // Эти надстройки ставят и на шасси с мотором, поэтому послаблений нет:
  // иначе освобождение стало бы лазейкой для обычного грузовика.
  assert.deepEqual(fields({ vehicleType: "TRUCK", subtype: "TENT" }), [
    "year",
    "mileage",
    "fuelType",
    "transmission",
    "engineVolume",
  ])
  assert.equal(fields({ vehicleType: "TRUCK", subtype: "VAN" }).includes("engineVolume"), true)
})

test("у планера двигателя нет — вместо объёма остаётся мощность", () => {
  const specs = fields({ vehicleType: "AIR", subtype: "GLIDER" })
  assert.equal(specs.includes("engineVolume"), false)
})

test("неизвестный вид транспорта считается легковым", () => {
  // Подделанный запрос не должен получать более мягкий набор, чем обычная
  // машина: неизвестное значение падает в самый строгий вариант.
  assert.deepEqual(fields({ vehicleType: "SOMETHING" }), fields({ vehicleType: "CAR" }))
  assert.deepEqual(fields({}), fields({ vehicleType: "CAR" }))
})

test("заполненное объявление проходит проверку", () => {
  assert.equal(
    validateRequiredSpecs({
      vehicleType: "CAR",
      year: 2018,
      mileage: 120_000,
      fuelType: "GASOLINE",
      transmission: "AUTOMATIC",
      engineVolume: 2,
    }),
    null,
  )
})

test("нулевой пробег у новой машины — настоящее значение", () => {
  // «0 км» пишут у новой техники. Считать ноль пустым полем значит не дать
  // подать новый автомобиль вообще.
  assert.equal(
    validateRequiredSpecs({
      vehicleType: "CAR",
      year: 2026,
      mileage: 0,
      fuelType: "GASOLINE",
      transmission: "AUTOMATIC",
      engineVolume: 1.6,
    }),
    null,
  )
})

test("нулевой объём двигателя не считается заполненным", () => {
  // Ноль литров у бензинового мотора невозможен — это способ проскочить
  // проверку, вписав что попало.
  const missing = getMissingSpecs({
    vehicleType: "CAR",
    year: 2018,
    mileage: 100,
    fuelType: "GASOLINE",
    transmission: "AUTOMATIC",
    engineVolume: 0,
  })
  assert.deepEqual(missing.map((spec) => spec.field), ["engineVolume"])
})

test("ошибка называет недостающие поля поимённо", () => {
  // «Заполните все поля» продавцу ничего не даёт: форма длинная, и он ищет
  // пропуск глазами.
  const message = validateRequiredSpecs({
    vehicleType: "CAR",
    year: 2018,
    fuelType: "GASOLINE",
  })
  assert.ok(message)
  assert.ok(message.includes("Пробег"), "в тексте должно быть названо конкретное поле")
  assert.ok(message.includes("Коробка передач"))
  assert.ok(message.includes("Объём двигателя"))
  assert.equal(message.includes("Год выпуска"), false, "заполненное поле в ошибке не упоминается")
})

test("единица измерения попадает в текст ошибки", () => {
  const message = validateRequiredSpecs({ vehicleType: "SPECIAL", year: 2015, fuelType: "DIESEL", engineVolume: 4 })
  assert.ok(message)
  assert.ok(message.includes("м/ч"), "продавец должен видеть, в чём измеряется наработка")
})

test("одно недостающее поле формулируется в единственном числе", () => {
  const message = validateRequiredSpecs({
    vehicleType: "CAR",
    year: 2018,
    mileage: 10,
    fuelType: "GASOLINE",
    transmission: "MANUAL",
  })
  assert.ok(message?.startsWith("Укажите:"))
})

test("пустой список недостающего сообщения не даёт", () => {
  assert.equal(describeMissingSpecs([]), null)
})

test("пустая строка в селекте не считается выбором", () => {
  // Mantine возвращает пустую строку при сбросе селекта — это не значение.
  const missing = getMissingSpecs({
    vehicleType: "CAR",
    year: 2018,
    mileage: 10,
    fuelType: "",
    transmission: "   ",
    engineVolume: 2,
  })
  assert.deepEqual(missing.map((spec) => spec.field), ["fuelType", "transmission"])
})

test("подсказка до заполнения перечисляет поля своего вида техники", () => {
  const carHint = describeRequiredSpecs("CAR")
  assert.ok(carHint.includes("пробег"))
  assert.ok(carHint.includes("коробка передач"))

  const specialHint = describeRequiredSpecs("SPECIAL")
  assert.ok(specialHint.includes("наработка"), "у спецтехники счётчик называется иначе")
  assert.equal(specialHint.includes("коробка передач"), false)

  const airHint = describeRequiredSpecs("AIR")
  assert.ok(airHint.includes("налёт"))
  assert.ok(airHint.includes("мощность"))
})
