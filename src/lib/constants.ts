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
  { value: "ON_ORDER", label: "На заказ" },
  { value: "IN_TRANSIT", label: "В пути" },
] as const

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
export function findLabel<
  T extends { value: string; label: string }
>(arr: readonly T[], value: string | null | undefined): string {
  if (!value) return "—"
  return arr.find((item) => item.value === value)?.label ?? value
}
