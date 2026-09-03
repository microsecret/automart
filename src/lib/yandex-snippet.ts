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
 * Разбирает подпись карточки выдачи Яндекса.
 *
 * Форматов два, и они не похожи друг на друга.
 *
 * Короткий — карточка в свёрнутом списке:
 *   «Нефтьмагистраль92, 95, 95+, ДТ · Нет очереди»
 * Имя, марки и очередь идут по порядку, разделитель — точка посередине.
 *
 * Развёрнутый — карточка с фотографией и адресом:
 *   «ЛукойлФотоЛукойлКруглосуточноул. Маяковского, 1АСредняя очередь92ДТ»
 * Здесь марки стоят ПОСЛЕ очереди, а между именем и всем остальным
 * втиснуты слова «Фото», режим работы и адрес. Разделителя нет вовсе:
 * Яндекс рисует части разными элементами, а textContent их склеивает.
 *
 * Проверка на живой выдаче: коротких карточек три из девятнадцати,
 * остальные развёрнутые. Разбор только первого формата означал бы, что
 * очередь теряется у шести заправок из семи.
 */

/* Слова очереди — по ним и находится граница между адресом и марками в
   развёрнутой карточке. */
const QUEUE_PHRASES = ["Нет очереди", "Небольшая очередь", "Средняя очередь", "Большая очередь", "Очередь"]

/* Служебные слова карточки: они попадают в текст, но смысла не несут. */
const CARD_NOISE = /(Фото|Круглосуточно|Открыто|Закрыто|до \d{1,2}:\d{2}|этаж \d+)/gu

function extractFuels(source: string): string[] {
  const fuels = source
    .split(/[,\s]+/)
    .flatMap((token) => token.match(/(\d{2,3}\+?|ДТ\+?|Газ)/giu) ?? [])
    .map((token) => YANDEX_FUEL_MAP[token.trim().toLocaleLowerCase("ru-RU")] ?? null)
    .filter((fuel): fuel is string => Boolean(fuel))
  return [...new Set(fuels)]
}

export function parseYandexSnippet(raw: string | null): { name: string | null; fuels: string[]; queue: string | null } {
  if (!raw?.trim()) return { name: null, fuels: [], queue: null }
  const text = raw.replace(/\s+/gu, " ").trim()

  /* Формат определяется по разделителю, а не по словам очереди.

     Слово «очередь» есть в обоих, и поиск по нему первым уводил
     короткую карточку в разбор развёрнутой: «Нефтьмагистраль92, 95, ДТ»
     целиком попадало в имя. */
  const phrase = text.includes("·") ? null : QUEUE_PHRASES.find((candidate) => text.includes(candidate))
  if (phrase) {
    const at = text.indexOf(phrase)
    const head = text.slice(0, at)
    const tail = text.slice(at + phrase.length)

    /* Имя стоит первым и повторяется после слова «Фото»: берём до
       первого служебного слова или до начала адреса. */
    const name = head
      .split(CARD_NOISE)[0]
      .split(/(?=\p{Lu}\p{Ll}*\.|\d)/u)[0]
      .trim() || null

    return { name, fuels: extractFuels(tail), queue: phrase }
  }

  /* Короткая карточка: имя, марки, разделитель, очередь. */
  const [beforeQueue, ...queueParts] = text.split("·")
  const queueText = queueParts.join("·").trim() || null

  /* Граница имени и марок — первая цифра или «ДТ» после буквы. */
  const marker = beforeQueue.match(/\p{L}\s*(?:\d{2,3}|ДТ|Газ)/u)
  const boundary = marker?.index !== undefined ? marker.index + 1 : -1
  const name = (boundary > 0 ? beforeQueue.slice(0, boundary) : beforeQueue).trim() || null
  const fuelsPart = boundary > 0 ? beforeQueue.slice(boundary) : ""

  return { name, fuels: extractFuels(fuelsPart), queue: queueText }
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
