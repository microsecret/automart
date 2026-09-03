/**
 * Целевые города и области для сбора АЗС и цен.
 *
 * Общий список для всех источников (ГдеБЕНЗ, 2ГИС и других): каждый регион —
 * это прямоугольник, который источник умеет отдавать одним запросом или
 * несколькими страницами.
 */

export type FuelTargetRegion = {
  key: string
  city: string
  lat1: number
  lon1: number
  lat2: number
  lon2: number
}

export const FUEL_TARGET_REGIONS: ReadonlyArray<FuelTargetRegion> = [
  { key: "moscow", city: "Москва", lat1: 55.30, lon1: 37.00, lat2: 56.20, lon2: 38.20 },
  { key: "moscow-oblast", city: "Московская область", lat1: 54.20, lon1: 35.00, lat2: 56.90, lon2: 40.30 },
  /* Екатеринбург и область — четвёртый по величине автомобильный рынок
     страны и главный узел трасс между европейской частью и Сибирью.
     Прямоугольник города захватывает Верхнюю Пышму и Берёзовский: они
     срослись с Екатеринбургом застройкой, и водитель не отличает их
     заправки от городских. */
  { key: "ekaterinburg", city: "Екатеринбург", lat1: 56.65, lon1: 60.35, lat2: 57.05, lon2: 60.90 },
  /* Область вытянута с севера на юг почти на семьсот километров.
     Прямоугольник покрывает Нижний Тагил, Каменск-Уральский, Первоуральск
     и трассу Р-351 на Тюмень — там, где заправка нужнее всего. */
  { key: "sverdlovsk-oblast", city: "Свердловская область", lat1: 56.00, lon1: 57.00, lat2: 61.50, lon2: 64.00 },
  { key: "ufa", city: "Уфа", lat1: 54.50, lon1: 55.60, lat2: 55.00, lon2: 56.40 },
  { key: "bashkortostan", city: "Республика Башкортостан", lat1: 51.80, lon1: 53.00, lat2: 56.50, lon2: 60.00 },
  { key: "kazan", city: "Казань", lat1: 55.60, lon1: 48.80, lat2: 56.00, lon2: 49.60 },
  { key: "tatarstan", city: "Республика Татарстан", lat1: 54.20, lon1: 47.20, lat2: 56.80, lon2: 53.80 },
  { key: "naberezhnye-chelny", city: "Набережные Челны", lat1: 55.55, lon1: 52.10, lat2: 55.90, lon2: 52.80 },
  { key: "nizhnekamsk", city: "Нижнекамск", lat1: 55.50, lon1: 51.50, lat2: 55.80, lon2: 52.00 },
  { key: "ishimbay", city: "Ишимбай", lat1: 53.30, lon1: 55.80, lat2: 53.60, lon2: 56.20 },
  { key: "sterlitamak", city: "Стерлитамак", lat1: 53.50, lon1: 55.80, lat2: 53.80, lon2: 56.20 },
  /* Остальная Россия — крупными прямоугольниками по федеральным округам.

     Границы проведены по заселённой полосе: океан, тундра и высокогорье
     в них не входят, потому что заправок там нет, а время обхода они
     съедают. Внутри каждого источник сам режет прямоугольник на клетки
     того размера, который отдаёт его API.

     Регионы выше — города, где сбор идёт часто. Эти обходятся по кругу:
     за час скользящий обход проходит страну целиком, и каждая точка
     обновляется раз в час. Складывать всё в один прогон нельзя — сорок
     девять минут на источник не укладываются в пятнадцатиминутный цикл,
     и следующий запуск начинался бы поверх незавершённого. */
  { key: "ru-center", city: "Центральная Россия", lat1: 52.00, lon1: 31.00, lat2: 58.50, lon2: 47.00 },
  { key: "ru-northwest", city: "Северо-Запад", lat1: 55.00, lon1: 27.00, lat2: 62.00, lon2: 45.00 },
  { key: "ru-south", city: "Юг России", lat1: 43.00, lon1: 36.00, lat2: 50.50, lon2: 48.50 },
  { key: "ru-caucasus", city: "Северный Кавказ", lat1: 41.00, lon1: 41.50, lat2: 45.50, lon2: 48.50 },
  { key: "ru-volga-west", city: "Поволжье", lat1: 50.50, lon1: 43.00, lat2: 57.00, lon2: 52.00 },
  { key: "ru-volga-east", city: "Предуралье", lat1: 50.50, lon1: 52.00, lat2: 58.50, lon2: 60.00 },
  { key: "ru-ural", city: "Урал", lat1: 54.00, lon1: 57.00, lat2: 62.00, lon2: 70.00 },
  { key: "ru-siberia-west", city: "Западная Сибирь", lat1: 50.00, lon1: 70.00, lat2: 58.00, lon2: 88.00 },
  { key: "ru-siberia-east", city: "Восточная Сибирь", lat1: 50.00, lon1: 88.00, lat2: 58.50, lon2: 108.00 },
  { key: "ru-baikal", city: "Прибайкалье и Забайкалье", lat1: 49.50, lon1: 108.00, lat2: 57.00, lon2: 122.00 },
  { key: "ru-far-east", city: "Дальний Восток", lat1: 42.50, lon1: 126.00, lat2: 56.00, lon2: 143.00 },
  { key: "ru-north", city: "Север Сибири", lat1: 58.00, lon1: 60.00, lat2: 67.00, lon2: 95.00 },
]

/* Города, где сбор идёт при каждом запуске: там больше всего
   пользователей, и цена вчерашнего дня там заметна. */
export const FREQUENT_REGION_KEYS: ReadonlyArray<string> = [
  "moscow", "moscow-oblast", "ekaterinburg", "sverdlovsk-oblast",
  "ufa", "bashkortostan", "kazan", "tatarstan",
  "naberezhnye-chelny", "nizhnekamsk", "ishimbay", "sterlitamak",
]

/* Крупные прямоугольники обходятся по кругу — по одному за запуск. */
export const ROTATING_REGION_KEYS: ReadonlyArray<string> = FUEL_TARGET_REGIONS
  .map((region) => region.key)
  .filter((key) => !FREQUENT_REGION_KEYS.includes(key))

/**
 * Регионы для очередного автоматического прогона.
 *
 * Частые города берутся всегда, а из крупных прямоугольников — один,
 * следующий по кругу. Номер шага считается от времени, поэтому состояние
 * нигде не хранится: два процесса, запущенные в одну минуту, выберут
 * один и тот же регион и не разойдутся.
 *
 * Полный круг по стране при запуске раз в пятнадцать минут занимает три
 * часа. Точка вне частых городов обновляется раз в три часа — для цены
 * на трассе это приемлемо, а для города рядом с домом работает частый
 * набор.
 */
export function regionsForScheduledRun(now: Date = new Date()): string[] {
  if (!ROTATING_REGION_KEYS.length) return [...FREQUENT_REGION_KEYS]
  const step = Math.floor(now.getTime() / (15 * 60_000))
  const rotating = ROTATING_REGION_KEYS[step % ROTATING_REGION_KEYS.length]
  return [...FREQUENT_REGION_KEYS, rotating]
}

export function resolveTargetRegions(keys?: string[]): FuelTargetRegion[] {
  const requested = keys?.length ? new Set(keys) : null
  return FUEL_TARGET_REGIONS.filter((region) => !requested || requested.has(region.key))
}

export function targetRegionKeys(): string[] {
  return FUEL_TARGET_REGIONS.map((region) => region.key)
}
