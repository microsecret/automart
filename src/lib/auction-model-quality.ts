/**
 * Чистка названий моделей от следов неудачного перевода.
 *
 * Лоты с корейских и китайских площадок приходят с названиями на родном
 * языке, их переводит внешняя служба. Иногда она справляется наполовину
 * и оставляет слипшийся комок: «Citroen C3eakurosuSUV», «BYD Han 2025
 * DM-i Smart Drive 125KMlidarFlagship», «Hyundai беNew».
 *
 * Замер базы на 19 сентября 2026: таких названий 449 из 16 248 — 2,8%.
 * В каталоге это терпимо: человек пришёл за списком и видит фотографию
 * с ценой. В витрине из пяти строк одна такая занимает пятую часть
 * блока и выглядит поломкой.
 *
 * Здесь не чинится перевод — только распознаётся негодный кусок. Где
 * читаемое начало есть, хвост обрезается; где всё название комок —
 * лот не попадает в витрину, но остаётся в каталоге и поиске.
 */

/** Слипшиеся кириллица с латиницей внутри одного слова: «беNew». */
function isMixedScript(word: string): boolean {
  return /[а-яА-ЯёЁ]/.test(word) && /[a-zA-Z]/.test(word)
}

/**
 * Длинное латинское слово с заглавными внутри: «125KMlidarFlagship».
 *
 * Двенадцать знаков и две заглавные буквы после первой — порог, при
 * котором нормальные обозначения вроде «xDrive30d» и «DSGYuexing» ещё
 * проходят, а склейка из трёх слов уже нет.
 */
function isGluedLatin(word: string): boolean {
  if (word.length < 12) return false
  if (!/^[A-Za-z0-9-]+$/.test(word)) return false
  const capitals = word.slice(1).split("").filter((c) => c >= "A" && c <= "Z").length
  return capitals >= 2
}

/**
 * Кириллическое слово без достаточного числа гласных: «кыльсрос».
 *
 * Русские слова длиной от шести букв почти всегда содержат хотя бы
 * треть гласных. Транслитерация корейского даёт цепочки согласных,
 * которые человек прочесть не может.
 */
function isUnreadableCyrillic(word: string): boolean {
  if (!/^[а-яА-ЯёЁ]{6,}$/.test(word)) return false
  const vowels = word.split("").filter((c) => "аеёиоуыэюя".includes(c.toLowerCase())).length
  return vowels / word.length < 0.3
}

function isJunkWord(word: string): boolean {
  return isMixedScript(word) || isGluedLatin(word) || isUnreadableCyrillic(word)
}

/**
 * Название без мусорного хвоста.
 *
 * «BYD Han 2025 DM-i Smart Drive 125KMlidarFlagship» превращается в
 * «BYD Han 2025 DM-i Smart Drive» — читаемая часть сохраняется, потому
 * что выбрасывать лот целиком из-за одного слова расточительно: у
 * площадки и так немного машин из Китая.
 *
 * Обрезается только хвост. Если мусор стоит в начале — как в
 * «C3eakurosuSUV», где всё название и есть комок, — не остаётся
 * ничего, и лот отсеивается проверкой ниже.
 */
export function cleanModelLabel(model: string | null | undefined): string {
  if (!model) return ""
  const words = model.trim().split(/\s+/)
  let end = words.length
  while (end > 0 && isJunkWord(words[end - 1])) end -= 1
  return words.slice(0, end).join(" ")
}

/**
 * Годится ли лот для витрины.
 *
 * Требования к лоту в витрине выше, чем в каталоге: она показывает
 * площадку с лучшей стороны. Нужны марка или читаемая модель — и ни
 * одного мусорного слова в том, что останется на экране.
 */
export function isShowcaseReady(lot: {
  make?: string | null
  model?: string | null
  imageUrl?: string | null
}): boolean {
  const cleaned = cleanModelLabel(lot.model)
  if (!lot.make && !cleaned) return false
  /* Мусор мог остаться в середине: «New каунти чангчук 25-местный».
     Обрезка снимает только хвост, поэтому проверяем всё, что осталось. */
  if (cleaned.split(/\s+/).some(isJunkWord)) return false
  return true
}
