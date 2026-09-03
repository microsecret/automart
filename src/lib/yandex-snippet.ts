/**
 * Разбор подписи карточки в выдаче Яндекс Карт.
 *
 * Вынесено отдельным модулем без зависимостей: сам сборщик тянет браузер
 * и справочник регионов через псевдоним «@/lib», который понимает
 * сборщик, но не тестовый запуск Node, — и разбор оставался
 * непроверенным. А это самая хрупкая часть источника: Яндекс меняет
 * вёрстку, и заметить это должен тест, а не пустая карта.
 */

/* Марки топлива в подписи Яндекса — в наши коды. «95+» это тот же
   девяносто пятый улучшенный, отдельной марки у нас нет. */
const YANDEX_FUEL_MAP: Readonly<Record<string, string>> = {
  "92": "AI92",
  "92+": "AI92",
  "95": "AI95",
  "95+": "AI95",
  "98": "AI98",
  "100": "AI100",
  "дт": "DT",
  "дт+": "DT",
  "газ": "GAS",
  "спг": "GAS",
  "сug": "GAS",
}

type YandexSnippet = {
  id: string | null
  title: string | null
  longitude: number
  latitude: number
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

/**
 * Разбирает подпись карточки: «Нефтьмагистраль92, 95, 95+, ДТ · Нет очереди».
 *
 * Название, марки и очередь склеены в одну строку без разделителя между
 * именем и первой маркой — Яндекс рисует их разными элементами, а
 * textContent их соединяет. Марки всегда начинаются с цифры или с «ДТ»,
 * поэтому граница ищется по первому такому вхождению.
 */
export function parseYandexSnippet(raw: string | null): { name: string | null; fuels: string[]; queue: string | null } {
  if (!raw) return { name: null, fuels: [], queue: null }

  const [beforeQueue, ...queueParts] = raw.split("·")
  const queueText = queueParts.join("·").trim() || null

  /* Граница имени и списка марок: первая цифра или «ДТ» после буквы. */
  const boundary = beforeQueue.search(/(?<=\p{L})\s*(?:\d{2,3}|ДТ|Газ)\b/u)
  const name = (boundary > 0 ? beforeQueue.slice(0, boundary) : beforeQueue).trim() || null
  const fuelsPart = boundary > 0 ? beforeQueue.slice(boundary) : ""

  const fuels = fuelsPart
    .split(/[,\s]+/)
    .map((token) => YANDEX_FUEL_MAP[token.trim().toLocaleLowerCase("ru-RU")] ?? null)
    .filter((fuel): fuel is string => Boolean(fuel))

  return { name, fuels: [...new Set(fuels)], queue: queueText }
}

/**
 * Очередь словами Яндекса — в наше состояние заправки.
 *
 * «Нет очереди» значит, что заправка работает и туда можно ехать. Очередь
 * же — не повод считать, что топлива нет: наоборот, за ним и стоят.
 * Поэтому очередь не меняет статус наличия, а сохраняется отдельной
 * подписью.
 */
export function normalizeQueue(queue: string | null): string | null {
  if (!queue) return null
  const text = queue.toLocaleLowerCase("ru-RU")
  if (text.includes("нет очереди")) return "Нет очереди"
  if (text.includes("очеред")) return queue.trim()
  return null
}
