/**
 * Когда импортированная заправка считается пропавшей из источника.
 *
 * Сбор только добавлял и обновлял точки, но никогда не удалял: если
 * источник переставал отдавать заправку, её строка жила в базе вечно и
 * каждый день показывалась на карте. Так в центре Уфы стояла «Татнефть»,
 * которой в городе нет: пользовательская метка ГдеБЕНЗ без цен, без
 * адреса и без наличия. Источник убрал её 19 сентября, а у нас она
 * осталась. По базе на 29.09.2026 правило снимает 1375 таких строк
 * (1364 у ГдеБЕНЗ, 11 у ГдеЗаправки), и лишь у 67 из них есть хоть одна
 * цена: это пустые метки, которые только занимают место на карте.
 *
 * Модуль без импортов и без базы: правило проверяется тестом и тем же
 * кодом применяется разовым скриптом чистки, чтобы чистка и сбор не
 * разошлись в правилах.
 */

/* Три дня — с запасом против сбоев.

   Частые города обходятся каждые пятнадцать минут, крупные прямоугольники —
   раз в три часа. За трое суток регион успешно собирается минимум два
   десятка раз, и точка, не пришедшая ни в одном из этих ответов, ушла из
   источника, а не потерялась в одном неудачном запросе. Массовые исчезновения
   по базе и правда идут пачками одного дня (767 точек ГдеБЕНЗ 2 сентября,
   487 — 12-го): источник перенумеровал или снял свои записи разом. */
export const VANISHED_AFTER_DAYS = 3

/* Чистить можно только за источником, который отдаёт регион одним полным
   списком. У 2ГИС, Яндекса и Т-Банка регион режется на клетки и страницы,
   и отсутствие точки в одном прогоне ничего не доказывает. */
export const PRUNABLE_FUEL_SOURCES: ReadonlyArray<string> = ["GDEBENZ", "GDEZAPRAVKA"]

/* Потолок ответа источника на один прямоугольник.

   ГдеЗаправка отдаёт не больше двух тысяч станций, и большой регион
   приходит обрезанным: у «Западной Сибири» в базе 2308 её точек, из них
   свежих ровно 2000, а 308 не обновлялись — это не пропавшие, а не
   влезшие в ответ заправки. Ответ длиной в потолок считается неполным, и
   чистка по нему не идёт. У ГдеБЕНЗ потолка в ответах не видно. */
export const SOURCE_REGION_CAPS: Readonly<Record<string, number>> = {
  GDEZAPRAVKA: 2000,
}

/* Предохранитель на случай, когда источник вдруг начнёт отдавать регион
   урезанным без видимого потолка. Больше половины точек региона разом
   не пропадает: наибольшая доля по базе — треть, у ГдеБЕНЗ в Казани,
   и это одноразовый хвост перенумерации. */
export const MAX_PRUNE_SHARE = 0.5

export type RegionBox = { lat1: number; lon1: number; lat2: number; lon2: number }

export type FreshnessProbe = { latitude: number; longitude: number; updatedAt: Date }

export function vanishedCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - VANISHED_AFTER_DAYS * 24 * 60 * 60_000)
}

export function isInsideRegion(point: { latitude: number; longitude: number }, region: RegionBox): boolean {
  return point.latitude >= region.lat1 && point.latitude <= region.lat2
    && point.longitude >= region.lon1 && point.longitude <= region.lon2
}

/** Точка лежит в собранном регионе и не приходила от источника дольше порога. */
export function isVanishedFromSource(station: FreshnessProbe, region: RegionBox, now: Date = new Date()): boolean {
  return isInsideRegion(station, region) && station.updatedAt.getTime() < vanishedCutoff(now).getTime()
}

/** Ответ источника по региону достаточно полон, чтобы по нему чистить. */
export function isCompleteRegionAnswer(source: string, fetched: number): boolean {
  if (!PRUNABLE_FUEL_SOURCES.includes(source)) return false
  /* Пустой ответ — это сбой источника, а не исчезновение всех заправок. */
  if (fetched <= 0) return false
  const cap = SOURCE_REGION_CAPS[source]
  return cap === undefined || fetched < cap
}

/**
 * Можно ли удалить пропавшие точки региона.
 *
 * `fetched` — сколько станций источник отдал по региону в этом прогоне,
 * `vanished` — сколько его точек в прямоугольнике не приходили дольше
 * порога, `total` — сколько его точек в прямоугольнике всего.
 */
export function shouldPruneRegion(input: { source: string; fetched: number; vanished: number; total: number }): boolean {
  if (!isCompleteRegionAnswer(input.source, input.fetched)) return false
  if (input.vanished <= 0 || input.total <= 0) return false
  return input.vanished / input.total <= MAX_PRUNE_SHARE
}
