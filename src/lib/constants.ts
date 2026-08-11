/** Константы домена — марки, типы кузова, КПП, двигатель и т.д. */

export const CAR_BRANDS = [
  "Lada (ВАЗ)",
  "Toyota",
  "Volkswagen",
  "BMW",
  "Mercedes-Benz",
  "Audi",
  "Hyundai",
  "Kia",
  "Nissan",
  "Mazda",
  "Honda",
  "Ford",
  "Chevrolet",
  "Skoda",
  "Mitsubishi",
  "Lexus",
  "Porsche",
  "Land Rover",
  "Subaru",
  "Volvo",
  "Renault",
  "Peugeot",
  "Citroen",
  "Geely",
  "Chery",
  "Haval",
  "Exeed",
  "Changan",
  "Omoda",
  "Jetour",
  "Tank",
  "Zeekr",
  "Li Auto",
  "BYD",
  "Tesla",
] as const

export const BODY_TYPES = [
  { value: "SEDAN", label: "Седан" },
  { value: "HATCHBACK", label: "Хэтчбек" },
  { value: "SUV", label: "Внедорожник" },
  { value: "CROSSOVER", label: "Кроссовер" },
  { value: "COUPE", label: "Купе" },
  { value: "CONVERTIBLE", label: "Кабриолет" },
  { value: "WAGON", label: "Универсал" },
  { value: "MINIVAN", label: "Минивэн" },
  { value: "PICKUP", label: "Пикап" },
  { value: "LIFTBACK", label: "Лифтбек" },
  { value: "OTHER", label: "Другое" },
] as const

export const FUEL_TYPES = [
  { value: "GASOLINE", label: "Бензин" },
  { value: "DIESEL", label: "Дизель" },
  { value: "ELECTRIC", label: "Электро" },
  { value: "HYBRID", label: "Гибрид" },
  { value: "GAS", label: "Газ" },
  { value: "OTHER", label: "Другое" },
] as const

export const TRANSMISSIONS = [
  { value: "MANUAL", label: "Механика" },
  { value: "AUTOMATIC", label: "Автомат" },
  { value: "VARIATOR", label: "Вариатор" },
  { value: "ROBOTIC", label: "Робот" },
] as const

export const AIR_FUEL_TYPES = [
  { value: "JET_A1", label: "Авиационный керосин / Jet A-1" },
  { value: "AVGAS", label: "Авиационный бензин / Avgas" },
  { value: "DIESEL", label: "Авиационный дизель" },
] as const

export const TRUCK_TRANSMISSIONS = [
  { value: "MANUAL", label: "Механика" },
  { value: "AUTOMATIC", label: "Автомат" },
  { value: "ROBOTIC", label: "Роботизированная КПП" },
] as const

export const MOTORCYCLE_TRANSMISSIONS = [
  { value: "MANUAL", label: "Механика" },
  { value: "AUTOMATIC", label: "АКПП / DCT" },
  { value: "VARIATOR", label: "Вариатор / ремень" },
] as const

export type TransportVehicleType = "CAR" | "MOTORCYCLE" | "TRUCK" | "SPECIAL" | "WATER" | "AIR"

export type VehicleIdentityField = "vin" | "serialNumber" | "registrationNumber"

type VehicleIdentityMeta = {
  field: VehicleIdentityField
  label: string
  badgeLabel: string
  placeholder: string
  description: string
  maxLength: number
}

const VEHICLE_IDENTITY_META: Record<TransportVehicleType, VehicleIdentityMeta> = {
  CAR: {
    field: "vin",
    label: "VIN",
    badgeLabel: "VIN",
    placeholder: "17 символов",
    description: "Нужен для проверки истории и защиты от дублей.",
    maxLength: 17,
  },
  MOTORCYCLE: {
    field: "vin",
    label: "VIN",
    badgeLabel: "VIN",
    placeholder: "17 символов",
    description: "Нужен для проверки истории и защиты от дублей.",
    maxLength: 17,
  },
  TRUCK: {
    field: "vin",
    label: "VIN",
    badgeLabel: "VIN",
    placeholder: "17 символов",
    description: "Нужен для проверки истории и защиты от дублей.",
    maxLength: 17,
  },
  SPECIAL: {
    field: "serialNumber",
    label: "Заводской номер или VIN",
    badgeLabel: "Заводской №",
    placeholder: "Например, CAT-320-2020-001",
    description: "Используется для проверки техники и защиты от дублей.",
    maxLength: 32,
  },
  WATER: {
    field: "registrationNumber",
    label: "Бортовой номер или HIN",
    badgeLabel: "Бортовой № / HIN",
    placeholder: "Например, RU-12345 или ABC12345D323",
    description: "Номер корпуса или регистрации помогает подтвердить судно.",
    maxLength: 32,
  },
  AIR: {
    field: "registrationNumber",
    label: "Регистрационный номер ВС",
    badgeLabel: "Регистрационный №",
    placeholder: "Например, RA-12345",
    description: "Регистрационный или серийный номер воздушного судна.",
    maxLength: 32,
  },
}

export function getVehicleIdentityMeta(vehicleType: string | null | undefined): VehicleIdentityMeta {
  return VEHICLE_IDENTITY_META[(vehicleType || "CAR") as TransportVehicleType] || VEHICLE_IDENTITY_META.CAR
}

export function supportsTransmission(vehicleType: string | null | undefined) {
  return vehicleType === "CAR" || vehicleType === "MOTORCYCLE" || vehicleType === "TRUCK"
}

export function getTransmissionOptions(vehicleType: string | null | undefined) {
  if (vehicleType === "TRUCK") return TRUCK_TRANSMISSIONS
  if (vehicleType === "MOTORCYCLE") return MOTORCYCLE_TRANSMISSIONS
  return vehicleType === "CAR" ? TRANSMISSIONS : []
}

export function getFuelOptions(vehicleType: string | null | undefined) {
  return vehicleType === "AIR" ? AIR_FUEL_TYPES : FUEL_TYPES
}

/**
 * Rules that protect the catalogue from physically impossible demo and user
 * data.  They deliberately cover only manufacturers and model years with an
 * unambiguous electric-only history, so hybrid-capable brands remain free to
 * publish their valid petrol and hybrid models.
 */
export const ELECTRIC_ONLY_CAR_MAKES = new Set([
  "Tesla",
  "Zeekr",
  "Nio",
  "Xpeng",
  "Avatr",
])

const CAR_MODEL_YEAR_FLOORS: Record<string, number> = {
  "Tesla::Model Y": 2020,
}

export function validateVehicleEnergyAndModelYear(
  vehicleType: string | null | undefined,
  make: string,
  model: string,
  year: number,
  fuelType: string,
  transmission?: string | null,
) {
  if (vehicleType !== "CAR") return null

  if (ELECTRIC_ONLY_CAR_MAKES.has(make) && fuelType !== "ELECTRIC") {
    return `${make} выпускает только электромобили. Выберите тип топлива «Электро».`
  }

  if (ELECTRIC_ONLY_CAR_MAKES.has(make) && transmission && transmission !== "AUTOMATIC") {
    return `${make} не использует механическую, вариаторную или роботизированную КПП. Выберите «Автомат».`
  }

  // The current-generation Duster is sold with combustion and hybrid
  // powertrains, but never as a battery-electric vehicle. Keep this
  // deliberately model-specific so we do not block valid EVs from Renault.
  if (make === "Renault" && model === "Duster" && fuelType === "ELECTRIC") {
    return "Renault Duster не выпускается в электрической версии. Выберите фактический тип топлива."
  }

  const firstModelYear = CAR_MODEL_YEAR_FLOORS[`${make}::${model}`]
  if (firstModelYear && year < firstModelYear) {
    return `${make} ${model} выпускается с ${firstModelYear} года. Проверьте год выпуска.`
  }

  return null
}

export function getUsageMeta(vehicleType: string | null | undefined) {
  if (vehicleType === "AIR") return { field: "flightHours", label: "Налёт", unit: "ч" } as const
  if (vehicleType === "SPECIAL" || vehicleType === "WATER") return { field: "operatingHours", label: "Наработка", unit: "м/ч" } as const
  return { field: "mileage", label: "Пробег", unit: "км" } as const
}

export const DRIVE_TYPES = [
  { value: "FWD", label: "Передний" },
  { value: "RWD", label: "Задний" },
  { value: "AWD", label: "Полный" },
  { value: "FOUR_WD", label: "Подключаемый 4WD" },
] as const

export const CONDITIONS = [
  { value: "NEW", label: "Новый" },
  { value: "LIKE_NEW", label: "Как новый" },
  { value: "EXCELLENT", label: "Отличное" },
  { value: "GOOD", label: "Хорошее" },
  { value: "FAIR", label: "Среднее" },
  { value: "POOR", label: "Требует ремонта" },
] as const

/**
 * Для товара важнее происхождение, чем субъективная оценка продавца.
 * Детальные исторические значения нормализуются в USED на уровне данных.
 */
export const PART_CONDITIONS = [
  { value: "NEW", label: "Новая" },
  { value: "USED", label: "Б/у" },
] as const

export const PART_TYPES = [
  { value: "ENGINE", label: "Двигатель" },
  { value: "TRANSMISSION", label: "Трансмиссия" },
  { value: "SUSPENSION", label: "Подвеска" },
  { value: "BRAKES", label: "Тормоза" },
  { value: "ELECTRICAL", label: "Электрика" },
  { value: "BODY", label: "Кузов" },
  { value: "INTERIOR", label: "Салон" },
  { value: "WHEELS", label: "Колёса и диски" },
  { value: "LIGHTING", label: "Оптика" },
  { value: "COOLING", label: "Охлаждение" },
  { value: "EXHAUST", label: "Выхлопная система" },
  { value: "STEERING", label: "Рулевое управление" },
  { value: "ACCESSORIES", label: "Аксессуары" },
  { value: "CONSUMABLES", label: "Расходники" },
  { value: "OTHER", label: "Другое" },
] as const

/** Подкатегории запчастей для каждой категории */
export const PART_SUBCATEGORIES: Record<string, string[]> = {
  ENGINE: ["Двигатель в сборе", "ГБЦ", "Поршневая группа", "Блок цилиндров", "Коленвал", "Турбина", "Ремень ГРМ", "Цепь ГРМ", "Свечи зажигания", "Форсунки", "Прокладки", "Датчики двигателя"],
  TRANSMISSION: ["АКПП в сборе", "МКПП в сборе", "Вариатор", "Сцепление", "Коробка передач (контракт)", "Двойная масса", "Шрусы", "Подшипники"],
  SUSPENSION: ["Амортизаторы", "Стойки стабилизатора", "Рычаги подвески", "Пружины", "Шаровые опоры", "Сайлентблоки", "Ступицы", "Поворотные кулаки"],
  BRAKES: ["Колодки тормозные", "Диски тормозные", "Суппорты", "Барабаны", "Тормозные шланги", "ABS модули", "Ручник"],
  ELECTRICAL: ["Генератор", "Стартер", "Аккумулятор", "Проводка", "ЭБУ (блок управления)", "Катушка зажигания", "Реле", "Предохранители"],
  BODY: ["Бампер передний", "Бампер задний", "Капот", "Крыло переднее", "Крыло заднее", "Дверь", "Багажник", "Решётка радиатора", "Зеркало", "Стекло"],
  INTERIOR: ["Сиденья", "Руль", "Панель приборов", "Кожаный салон", "Обшивка потолка", "Коврики", "Ручки дверей"],
  WHEELS: ["Диски R15", "Диски R16", "Диски R17", "Диски R18", "Диски R19-R22", "Шины летние", "Шины зимние", "Колёсные болты", "Колпаки"],
  LIGHTING: ["Фара LED", "Фара галоген", "Фара ксенон", "Противотуманные фары", "Задний фонарь", "Поворотник", "Подсветка номера"],
  COOLING: ["Радиатор", "Радиатор кондиционера", "Помпа", "Термостат", "Вентилятор охлаждения", "Расширительный бачок", "Патрубки"],
  EXHAUST: ["Глушитель", "Катализатор", "Резонатор", "Приёмная труба", "Гофра глушителя", "Насадка на выхлоп"],
  STEERING: ["Рулевая рейка", "Рулевой редуктор", "Наконечники рулевые", "Рулевые тяги", "ЭГУР", "ГУР"],
  ACCESSORIES: ["Видеорегистратор", "Эврик (автопуск)", "Коврики", "Брызговики", "Спойлер", "Обвес", "Тонировка", "Чехлы"],
  CONSUMABLES: ["Моторное масло", "Антифриз", "Тормозная жидкость", "Фильтр масляный", "Фильтр воздушный", "Фильтр салонный", "Щётки дворников"],
  OTHER: ["Прочее"],
}

export const SORT_OPTIONS = [
  { value: "newest", label: "Сначала новые" },
  { value: "oldest", label: "Сначала старые" },
  { value: "price_asc", label: "Дешевле" },
  { value: "price_desc", label: "Дороже" },
  { value: "year_desc", label: "Год: новее" },
  { value: "mileage_asc", label: "Пробег: меньше" },
] as const

export const POPULAR_CITIES = [
  "Москва",
  "Санкт-Петербург",
  "Новосибирск",
  "Екатеринбург",
  "Казань",
  "Нижний Новгород",
  "Краснодар",
  "Челябинск",
  "Самара",
  "Уфа",
  "Ростов-на-Дону",
  "Воронеж",
  "Пермь",
  "Волгоград",
  "Красноярск",
] as const

// === СПЕЦИФИЧНЫЕ ФИЛЬТРЫ ПО КАТЕГОРИЯМ ===

export const MOTORCYCLE_TYPES = [
  { value: "SPORT", label: "Спортбайк" },
  { value: "CRUISER", label: "Круизер" },
  { value: "ENDURO", label: "Эндуро" },
  { value: "CHOPPER", label: "Чоппер" },
  { value: "TOURING", label: "Туристический" },
  { value: "NAKED", label: "Нейкед" },
  { value: "ADVENTURE", label: "Адвенчер" },
  { value: "SCOOTER", label: "Скутер" },
  { value: "CROSS", label: "Кросс" },
  { value: "OTHER", label: "Другое" },
] as const

export const TRUCK_BODY_TYPES = [
  { value: "TENT", label: "Тент" },
  { value: "VAN", label: "Фургон" },
  { value: "DUMP", label: "Самосвал" },
  { value: "TANKER", label: "Цистерна" },
  { value: "FLATBED", label: "Бортовая" },
  { value: "REFRIGERATOR", label: "Рефрижератор" },
  { value: "CONTAINER", label: "Контейнеровоз" },
  { value: "TIMBER", label: "Лесовоз" },
  { value: "TRACTOR", label: "Седельный тягач" },
  { value: "OTHER", label: "Другое" },
] as const

export const TRUCK_AXLE_FORMULAS = [
  { value: "4x2", label: "4×2" },
  { value: "6x2", label: "6×2" },
  { value: "6x4", label: "6×4" },
  { value: "6x6", label: "6×6" },
  { value: "8x4", label: "8×4" },
  { value: "8x8", label: "8×8" },
  { value: "10x10", label: "10×10" },
] as const

export const SPECIAL_TYPES = [
  { value: "EXCAVATOR", label: "Экскаватор" },
  { value: "LOADER", label: "Погрузчик" },
  { value: "BULLDOZER", label: "Бульдозер" },
  { value: "CRANE", label: "Кран" },
  { value: "GRADER", label: "Грейдер" },
  { value: "ROLLER", label: "Каток" },
  { value: "TRACTOR_SP", label: "Трактор" },
  { value: "MIXER", label: "Бетоносмеситель" },
  { value: "DUMP_SP", label: "Самосвал спец." },
  { value: "OTHER", label: "Другое" },
] as const

export const WATER_TYPES = [
  { value: "JETSKI", label: "Гидроцикл" },
  { value: "BOAT", label: "Моторная лодка" },
  { value: "YACHT", label: "Яхта" },
  { value: "CATAMARAN", label: "Катамаран" },
  { value: "SAILBOAT", label: "Парусная яхта" },
  { value: "RIB", label: "RIB (жёсткий корпус)" },
  { value: "KAYAK", label: "Байдарка / каяк" },
  { value: "WATERSCOOTER", label: "Водный мотоцикл" },
  { value: "OTHER", label: "Другое" },
] as const

export const HULL_MATERIALS = [
  { value: "PLASTIC", label: "Пластик" },
  { value: "ALUMINUM", label: "Алюминий" },
  { value: "STEEL", label: "Сталь" },
  { value: "WOOD", label: "Дерево" },
  { value: "CARBON", label: "Карбон" },
  { value: "INFLATABLE", label: "Надувная" },
] as const

export const AIR_TYPES = [
  { value: "HELICOPTER", label: "Вертолёт" },
  { value: "AIRPLANE", label: "Самолёт" },
  { value: "GLIDER", label: "Планер" },
  { value: "ULTRALIGHT", label: "Сверхлёгкий (ULA)" },
  { value: "GYROCOPTER", label: "Автожир" },
  { value: "DRONE", label: "БПЛА / Дрон" },
  { value: "OTHER", label: "Другое" },
] as const

export const ENGINE_TYPE_AIR = [
  { value: "PISTON", label: "Поршневой" },
  { value: "TURBOPROP", label: "Турбовинтовой" },
  { value: "JET", label: "Реактивный" },
  { value: "NONE", label: "Без двигателя (планер)" },
] as const

// Мотоциклетные тормоза
export const MOTO_BRAKES = [
  { value: "DISC", label: "Дисковые" },
  { value: "DRUM", label: "Барабанные" },
  { value: "ABS", label: "ABS" },
  { value: "COMBINED", label: "Комбинированные" },
] as const

export const STEERING_WHEELS = [
  { value: "LEFT", label: "Левый" },
  { value: "RIGHT", label: "Правый" },
] as const

export const DOCUMENT_STATUSES = [
  { value: "CLEAN", label: "В порядке" },
  { value: "ISSUES", label: "Есть проблемы" },
  { value: "MISSING", label: "Нет документов" },
] as const

export const DAMAGE_INFO = [
  { value: "NONE", label: "Не битая" },
  { value: "REPAINTED", label: "Крашена" },
  { value: "DAMAGED", label: "Битая" },
  { value: "SEVERE", label: "Тотал" },
] as const

export const SELLER_TYPES = [
  { value: "OWNER", label: "Собственник" },
  { value: "DEALER", label: "Дилер / Салон" },
] as const

export const AVAILABILITY_TYPES = [
  { value: "IN_STOCK", label: "В наличии" },
  { value: "ON_ORDER", label: "Под заказ" },
  { value: "IN_TRANSIT", label: "В пути" },
] as const

/** В каталоге и форме запчастей не выводим логистическое «в пути» как отдельный способ покупки. */
export const PART_AVAILABILITY_TYPES = AVAILABILITY_TYPES.filter((item) => item.value !== "IN_TRANSIT")

export const OWNERS_COUNT_OPTIONS = [
  { value: "1", label: "1 владелец" },
  { value: "2", label: "2 владельца" },
  { value: "3", label: "3 владельца" },
  { value: "4", label: "4 владельца" },
  { value: "5", label: "5 и более" },
] as const

export const COUNTRIES_OF_ORIGIN = [
  { value: "RU", label: "🇷🇺 Россия" },
  { value: "CN", label: "🇨🇳 Китай" },
  { value: "JP", label: "🇯🇵 Япония" },
  { value: "DE", label: "🇩🇪 Германия" },
  { value: "KR", label: "🇰🇷 Корея" },
  { value: "US", label: "🇺🇸 США" },
  { value: "FR", label: "🇫🇷 Франция" },
  { value: "GB", label: "🇬🇧 Великобритания" },
  { value: "CZ", label: "🇨🇿 Чехия" },
  { value: "SE", label: "🇸🇪 Швеция" },
  { value: "IT", label: "🇮🇹 Италия" },
  { value: "ES", label: "🇪🇸 Испания" },
] as const

/** Поиск по словарю */
export function findLabel(arr: readonly { value: string; label: string }[], value: string | null | undefined): string {
  if (!value) return "—"
  return arr.find((item) => item.value === value)?.label ?? value
}
