/**
 * Обязательные характеристики объявления — по видам транспорта.
 *
 * Владелец площадки требует, чтобы объявление не публиковалось без главного:
 * год, пробег, коробка передач, топливо, двигатель, состояние и документы.
 * Но одинаковый
 * набор для всех видов не работает — половина полей у части техники просто
 * не существует, и обязательность превратилась бы в тупик, из которого
 * продавец выходит только выдумыванием числа.
 *
 * Поэтому набор считается для конкретной техники:
 *   • коробка есть только у дорожного транспорта (CAR, MOTORCYCLE, TRUCK) —
 *     `supportsTransmission` уже описывает это правило, и здесь оно берётся
 *     оттуда, а не дублируется;
 *   • счётчик наработки у каждого свой — километры, моточасы или налёт;
 *     единственный источник правды — `getUsageMeta`;
 *   • объём двигателя измеряется в литрах и у электротяги равен нулю; вместо
 *     него спрашивается мощность, которая есть у любого привода;
 *   • у прицепа (надстройка без тягача) нет ни двигателя, ни коробки, ни
 *     собственного пробега — требовать их бессмысленно;
 *   • у планера нет двигателя по определению.
 *
 * Модуль — чистые функции без обращений к базе и сети: форма и API берут
 * правило отсюда, поэтому клиент и сервер не могут разойтись.
 *
 * Правило применяется в форме, API и модерации. После production-деплоя тот
 * же валидатор перепроверяет старые активные карточки и обратимо возвращает
 * неполные объявления владельцу на доработку.
 */

// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { getUsageMeta, supportsTransmission } from "./constants.ts"

export type RequiredSpecField =
  | "year"
  | "subtype"
  | "mileage"
  | "operatingHours"
  | "flightHours"
  | "transmission"
  | "fuelType"
  | "engineVolume"
  | "power"
  | "bodyType"
  | "driveType"
  | "color"
  | "condition"
  | "steeringWheel"
  | "ownersCount"
  | "documentsStatus"
  | "damageInfo"
  | "sellerType"
  | "availability"
  | "customsCleared"
  | "generation"

/** Значения, которые продавец подаёт в форме. Всё необязательное — nullable. */
export type ListingSpecInput = {
  vehicleType?: string | null
  year?: number | string | null
  mileage?: number | string | null
  operatingHours?: number | string | null
  flightHours?: number | string | null
  transmission?: string | null
  fuelType?: string | null
  engineVolume?: number | string | null
  power?: number | string | null
  bodyType?: string | null
  driveType?: string | null
  color?: string | null
  condition?: string | null
  steeringWheel?: string | null
  ownersCount?: number | string | null
  documentsStatus?: string | null
  damageInfo?: string | null
  sellerType?: string | null
  availability?: string | null
  customsCleared?: boolean | null
  generation?: string | null
  /** Подтип: надстройка грузовика, категория ВС и т.п. — влияет на набор. */
  subtype?: string | null
}

export type RequiredSpec = {
  field: RequiredSpecField
  /** Подпись поля в форме — из неё же собирается текст ошибки. */
  label: string
  /** Единица измерения, если поле числовое. */
  unit?: string
}

/**
 * Надстройки грузовика без собственного двигателя.
 *
 * Полуприцеп-цистерна или контейнеровоз подаются в разделе грузовиков, но
 * это буксируемая техника: двигателя, коробки и одометра у неё нет.
 * Список намеренно узкий — «Тент» и «Фургон» бывают и на шасси с мотором,
 * поэтому в него не попали.
 */
const TRAILER_TRUCK_SUBTYPES = new Set(["TANKER", "CONTAINER"])

/** Категории ВС без двигателя: планер летает без силовой установки. */
const ENGINELESS_AIR_SUBTYPES = new Set(["GLIDER"])

/** Виды топлива, у которых объём двигателя в литрах не измеряется. */
const ENGINELESS_FUEL_TYPES = new Set(["ELECTRIC"])

const KNOWN_VEHICLE_TYPES = new Set(["CAR", "MOTORCYCLE", "TRUCK", "SPECIAL", "WATER", "AIR"])

/**
 * Незнакомый вид транспорта считается легковым.
 *
 * Иначе подделанный запрос получал бы набор мягче, чем обычная машина:
 * `supportsTransmission` сравнивает значение с тремя дорожными типами, и
 * любая посторонняя строка молча снимала бы требование коробки передач.
 */
function normalizeVehicleType(vehicleType: string | null | undefined): string {
  const value = String(vehicleType || "")
  return KNOWN_VEHICLE_TYPES.has(value) ? value : "CAR"
}

/** Есть ли у этой техники двигатель внутреннего сгорания с объёмом в литрах. */
function hasDisplacementEngine(input: ListingSpecInput): boolean {
  const vehicleType = normalizeVehicleType(input.vehicleType)
  const subtype = input.subtype || ""

  if (vehicleType === "TRUCK" && TRAILER_TRUCK_SUBTYPES.has(subtype)) return false
  if (vehicleType === "AIR" && ENGINELESS_AIR_SUBTYPES.has(subtype)) return false
  // У электротяги литров нет: вместо объёма спрашивается мощность.
  if (ENGINELESS_FUEL_TYPES.has(String(input.fuelType || ""))) return false
  // Воздушное судно описывается типом двигателя (поршневой, турбовинтовой,
  // реактивный), а не литрами — объём там ничего не сообщает покупателю.
  if (vehicleType === "AIR") return false
  return true
}

/** Тянут ли эту машину за собой — тогда ни коробки, ни пробега у неё нет. */
function isTowedUnit(input: ListingSpecInput): boolean {
  return normalizeVehicleType(input.vehicleType) === "TRUCK" && TRAILER_TRUCK_SUBTYPES.has(input.subtype || "")
}

/** Есть ли у техники силовая установка, для которой указывают мощность. */
function hasPowerUnit(input: ListingSpecInput): boolean {
  const vehicleType = normalizeVehicleType(input.vehicleType)
  if (isTowedUnit(input)) return false
  return !(vehicleType === "AIR" && ENGINELESS_AIR_SUBTYPES.has(input.subtype || ""))
}

/**
 * Набор обязательных характеристик для конкретной подачи.
 *
 * Набор зависит не только от вида транспорта, но и от уже введённых
 * значений: выбрав «Электро», продавец снимает с себя объём двигателя и
 * получает вместо него мощность. Поэтому функция принимает всю форму.
 */
export function getRequiredSpecs(input: ListingSpecInput): RequiredSpec[] {
  const vehicleType = normalizeVehicleType(input.vehicleType)
  const specs: RequiredSpec[] = [{ field: "year", label: "Год выпуска" }]

  // Счётчик наработки: километры, моточасы или налёт — решает getUsageMeta,
  // чтобы форма, карточка и эта проверка называли поле одинаково.
  if (!isTowedUnit(input)) {
    const usage = getUsageMeta(vehicleType)
    specs.push({ field: usage.field, label: usage.label, unit: usage.unit })
  }

  // Топливо обязательно везде, где есть силовая установка. У мотоцикла оно
  // почти всегда бензин, но «почти» — не повод подставлять значение за
  // продавца: электромотоциклы на площадке уже есть.
  if (hasPowerUnit(input)) {
    specs.push({ field: "fuelType", label: "Тип топлива" })
  }

  if (supportsTransmission(vehicleType) && !isTowedUnit(input)) {
    specs.push({ field: "transmission", label: "Коробка передач" })
  }

  if (hasDisplacementEngine(input)) {
    specs.push({ field: "engineVolume", label: "Объём двигателя", unit: "л" })
  }

  if (hasPowerUnit(input)) {
    // Auto.ru и Drom показывают мощность рядом с объёмом: это не замена для
    // ДВС, а самостоятельная характеристика. У электротяги и авиации она
    // остаётся главным числом силовой установки.
    specs.push({ field: "power", label: "Мощность", unit: "л.с." })
  }

  if (vehicleType === "CAR") {
    specs.push(
      { field: "bodyType", label: "Тип кузова" },
      { field: "driveType", label: "Привод" },
      { field: "steeringWheel", label: "Расположение руля" },
      { field: "ownersCount", label: "Количество владельцев по ПТС" },
      { field: "generation", label: "Поколение" },
    )
  } else if (vehicleType === "TRUCK") {
    specs.push(
      { field: "steeringWheel", label: "Расположение руля" },
      { field: "ownersCount", label: "Количество владельцев по ПТС" },
    )
  } else if (vehicleType === "MOTORCYCLE") {
    specs.push({ field: "ownersCount", label: "Количество владельцев по ПТС" })
  }

  specs.push(
    { field: "color", label: "Цвет" },
    { field: "condition", label: "Общее состояние" },
    { field: "documentsStatus", label: "Статус документов" },
    { field: "damageInfo", label: "Сведения о повреждениях" },
    { field: "sellerType", label: "Тип продавца" },
    { field: "availability", label: "Наличие" },
    { field: "customsCleared", label: "Таможенный статус" },
  )

  return specs
}

/** Заполнено ли числовое поле. Ноль — настоящее значение (новая техника). */
function isFilledNumber(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0
}

function isFilledText(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== ""
}

function readSpecValue(input: ListingSpecInput, field: RequiredSpecField): unknown {
  return input[field]
}

function isSpecFilled(input: ListingSpecInput, field: RequiredSpecField): boolean {
  const value = readSpecValue(input, field)
  if (field === "customsCleared") return typeof value === "boolean"
  if (field === "transmission" || field === "fuelType" || field === "subtype"
    || field === "bodyType" || field === "driveType" || field === "color"
    || field === "condition" || field === "steeringWheel" || field === "documentsStatus"
    || field === "damageInfo" || field === "sellerType" || field === "availability"
    || field === "generation") return isFilledText(value)
  // Объём двигателя дробный, остальные счётчики целые — но для «заполнено ли»
  // разницы нет, обе проверки сводятся к неотрицательному числу.
  if (field === "engineVolume") return isFilledNumber(value) && Number(value) > 0
  if (field === "power") return isFilledNumber(value) && Number(value) > 0
  if (field === "year") return isFilledNumber(value) && Number(value) > 0
  if (field === "ownersCount") return isFilledNumber(value) && Number.isInteger(Number(value))
  return isFilledNumber(value)
}

/** Какие из обязательных характеристик остались незаполненными. */
export function getMissingSpecs(input: ListingSpecInput): RequiredSpec[] {
  return getRequiredSpecs(input).filter((spec) => !isSpecFilled(input, spec.field))
}

/**
 * Текст ошибки, называющий недостающее поимённо.
 *
 * Общее «заполните все поля» продавцу ничего не даёт: форма длинная, и он
 * ищет пропуск глазами. Здесь перечисляются ровно те поля, которых не хватает.
 */
export function describeMissingSpecs(missing: readonly RequiredSpec[]): string | null {
  if (missing.length === 0) return null
  const names = missing.map((spec) => (spec.unit ? `${spec.label} (${spec.unit})` : spec.label))
  const list = names.join(", ")
  return missing.length === 1
    ? `Укажите: ${list} — без этого объявление не опубликовать.`
    : `Не хватает характеристик: ${list}. Без них объявление не опубликовать.`
}

/** Готова ли подача: null — можно публиковать, строка — что показать продавцу. */
export function validateRequiredSpecs(input: ListingSpecInput): string | null {
  return describeMissingSpecs(getMissingSpecs(input))
}

/**
 * Короткий перечень для подсказки ДО заполнения формы.
 *
 * Продавец должен узнать, что понадобится ПТС и одометр, до того как начал
 * вводить данные, — иначе он упрётся в ошибку на последнем шаге и уйдёт.
 */
export function describeRequiredSpecs(vehicleType: string | null | undefined): string {
  const specs = getRequiredSpecs({ vehicleType: normalizeVehicleType(vehicleType) })
  const names = specs.map((spec) => (spec.unit ? `${spec.label.toLocaleLowerCase("ru-RU")} (${spec.unit})` : spec.label.toLocaleLowerCase("ru-RU")))
  return `Понадобится: ${names.join(", ")}.`
}
