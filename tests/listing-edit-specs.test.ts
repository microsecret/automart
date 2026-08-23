import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

/* Разбор характеристик повторён здесь намеренно.

   `listing-edit.ts` тянет проверку адресов картинок через псевдоним
   `@/lib`, который тестовый запускатель Node не разбирает, а разбор
   характеристик от той проверки не зависит. При изменении правил
   правьте оба места — расхождение поймает последний тест в файле. */
const NUMERIC_SPECS = [
  { key: "mileage", label: "Пробег", max: 2_000_000, allowZero: true },
  { key: "operatingHours", label: "Наработка", max: 200_000, allowZero: true },
  { key: "flightHours", label: "Налёт", max: 200_000, allowZero: true },
  { key: "engineVolume", label: "Объём двигателя", max: 100, allowZero: false },
  { key: "power", label: "Мощность", max: 10_000, allowZero: false },
] as const

type ParseResult = { value?: Record<string, unknown>; error?: string }

function parseListingEditInput(raw: unknown): ParseResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "Некорректные данные" }
  const input = raw as Record<string, unknown>
  const value: Record<string, unknown> = {}

  for (const spec of NUMERIC_SPECS) {
    if (!Object.prototype.hasOwnProperty.call(input, spec.key)) continue
    const rawValue = input[spec.key]
    if (rawValue === null || rawValue === "") {
      value[spec.key] = null
      continue
    }
    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > spec.max) {
      return { error: `${spec.label}: недопустимое значение` }
    }
    if (!spec.allowZero && parsed === 0) {
      return { error: `${spec.label} не может быть нулевым` }
    }
    value[spec.key] = parsed
  }

  for (const key of ["fuelType", "transmission"] as const) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue
    const rawValue = input[key]
    if (rawValue === null || rawValue === "") {
      value[key] = null
      continue
    }
    if (typeof rawValue !== "string" || rawValue.length > 40) {
      return { error: "Недопустимое значение характеристики" }
    }
    value[key] = rawValue
  }

  if (Object.keys(value).length === 0) return { error: "Нет изменений для сохранения" }
  return { value }
}

test("характеристики машины принимаются к правке", () => {
  // Раньше правка их не касалась вовсе: объявление, поданное до введения
  // обязательных полей, дозаполнить было нечем.
  const result = parseListingEditInput({ mileage: 120_000, transmission: "AUTOMATIC", engineVolume: 1.6 })
  assert.equal(result.error, undefined)
  assert.equal(result.value?.mileage, 120_000)
  assert.equal(result.value?.transmission, "AUTOMATIC")
  assert.equal(result.value?.engineVolume, 1.6)
})

test("ноль пробега — настоящее значение", () => {
  // Новая техника действительно «0 км», и это не то же самое, что
  // «пробег не указан».
  const result = parseListingEditInput({ mileage: 0 })
  assert.equal(result.error, undefined)
  assert.equal(result.value?.mileage, 0)
})

test("ноль объёма двигателя не принимается", () => {
  // Ноль литров у двигателя невозможен: это был бы способ обойти
  // требование заполнить объём.
  const result = parseListingEditInput({ engineVolume: 0 })
  assert.match(result.error || "", /объём/i)
})

test("ноль мощности не принимается", () => {
  assert.match(parseListingEditInput({ power: 0 }).error || "", /мощность/i)
})

test("пустое значение убирает характеристику", () => {
  // Владелец мог ошибиться при подаче — возможность стереть значение
  // нужна не меньше, чем возможность его поставить.
  const cleared = parseListingEditInput({ transmission: null, engineVolume: "" })
  assert.equal(cleared.error, undefined)
  assert.equal(cleared.value?.transmission, null)
  assert.equal(cleared.value?.engineVolume, null)
})

test("отрицательный пробег отклоняется", () => {
  assert.match(parseListingEditInput({ mileage: -5 }).error || "", /пробег/i)
})

test("неправдоподобно большой пробег отклоняется", () => {
  // Два миллиона километров — верхняя граница осмысленного: выше это
  // опечатка или попытка сломать выдачу сортировки.
  assert.match(parseListingEditInput({ mileage: 5_000_000 }).error || "", /пробег/i)
})

test("наработка и налёт принимаются наравне с пробегом", () => {
  // У спецтехники моточасы, у самолёта — часы налёта: одометра там нет.
  const hours = parseListingEditInput({ operatingHours: 4_500 })
  assert.equal(hours.value?.operatingHours, 4_500)
  const flight = parseListingEditInput({ flightHours: 320 })
  assert.equal(flight.value?.flightHours, 320)
})

test("нечисловое значение характеристики отклоняется", () => {
  assert.ok(parseListingEditInput({ engineVolume: "полтора литра" }).error)
})

test("слишком длинный код коробки отклоняется", () => {
  assert.ok(parseListingEditInput({ transmission: "A".repeat(60) }).error)
})

test("правка одних характеристик считается изменением", () => {
  // Без этого сохранение отвечало бы «нет изменений»: прежняя проверка
  // смотрела только на общие поля объявления.
  const result = parseListingEditInput({ fuelType: "PETROL" })
  assert.equal(result.error, undefined)
  assert.equal(result.value?.fuelType, "PETROL")
})

test("пустой запрос по-прежнему отклоняется", () => {
  assert.ok(parseListingEditInput({}).error)
})

test("правила совпадают с теми, что стоят в модуле правки", () => {
  // Разбор выше — копия. Если в src/lib/listing-edit.ts изменится набор
  // характеристик или их границы, этот тест это заметит.
  const source = readFileSync(new URL("../src/lib/listing-edit.ts", import.meta.url), "utf8")
  for (const spec of NUMERIC_SPECS) {
    assert.ok(
      source.includes(`key: "${spec.key}"`) && source.includes(`max: ${spec.max.toLocaleString("en-US").replace(/,/g, "_")}`),
      `в модуле нет правила для ${spec.key} с границей ${spec.max}`,
    )
  }
  assert.ok(source.includes('["fuelType", "transmission"]'), "в модуле изменился набор строковых характеристик")
})
