/**
 * Правила форума.
 *
 * Вынесено из маршрутов, потому что проверять их нужно без базы и сети:
 * длина заголовка, безопасный адрес темы, порядок групп разделов.
 */

/** Оси, по которым устроены разделы. */
export const FORUM_GROUPS = [
  { key: "REGION", title: "По регионам", hint: "Обсуждения по федеральным округам и городам" },
  { key: "ORIGIN", title: "По маркам", hint: "Японские, немецкие, корейские, китайские и другие" },
  { key: "TOPIC", title: "По темам", hint: "Ремонт, растаможка, ПДД, тюнинг и общение" },
] as const

export type ForumGroupKey = (typeof FORUM_GROUPS)[number]["key"]

export const TOPIC_TITLE_MIN = 8
export const TOPIC_TITLE_MAX = 140
export const POST_MIN = 2
export const POST_MAX = 10_000
/* Подпись под сообщениями: два десятка символов на «Jolion 2023, Москва»
   хватает, а длинная подпись у активного участника занимает больше места,
   чем его же ответ. */
export const FORUM_SIGNATURE_MAX = 80

/** Сообщений на странице темы. */
export const POSTS_PER_PAGE = 20
/** Тем на странице раздела. */
export const TOPICS_PER_PAGE = 25

/**
 * Адрес темы из заголовка.
 *
 * Человекочитаемый адрес нужен поиску: /forum/kitayskie-avto/kak-vybrat-haval
 * индексируется лучше, чем набор цифр. Хвост из идентификатора гарантирует
 * уникальность — два человека вполне могут назвать темы одинаково.
 */
export function topicSlug(title: string, uniqueSuffix: string): string {
  const base = transliterate(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "")

  const suffix = uniqueSuffix.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toLowerCase()
  return base ? `${base}-${suffix}` : `tema-${suffix}`
}

/** Проверка заголовка темы; null — всё в порядке. */
export function validateTopicTitle(title: string): string | null {
  const trimmed = title.trim()
  if (trimmed.length < TOPIC_TITLE_MIN) return `Заголовок короче ${TOPIC_TITLE_MIN} символов — по нему не понять, о чём тема`
  if (trimmed.length > TOPIC_TITLE_MAX) return `Заголовок длиннее ${TOPIC_TITLE_MAX} символов`
  /* Заголовок капсом читается как крик и портит список тем. */
  const letters = trimmed.replace(/[^А-ЯЁA-Za-zа-яё]/g, "")
  if (letters.length > 10 && letters === letters.toUpperCase()) return "Не пишите заголовок заглавными буквами"
  return null
}

/** Проверка текста сообщения; null — всё в порядке. */
export function validatePostContent(content: string): string | null {
  const trimmed = content.trim()
  if (trimmed.length < POST_MIN) return "Сообщение пустое"
  if (trimmed.length > POST_MAX) return `Сообщение длиннее ${POST_MAX} символов`
  return null
}

/**
 * Метки тем.
 *
 * Метка организует раздел лучше, чем деление на подразделы: в одном
 * списке видно, где просят помощи, где уже нашли решение, а где продают.
 * Список короткий намеренно — десяток меток человек не читает, а
 * выбирает первую попавшуюся.
 *
 * «Решено» в этом списке нет: её ставит не автор, а отметка лучшего
 * ответа. Метка, которую надо не забыть поставить руками после того, как
 * вопрос решился, не ставится никогда.
 */
export const TOPIC_PREFIXES = [
  { value: "HELP", label: "Помогите", color: "orange" },
  { value: "QUESTION", label: "Вопрос", color: "blue" },
  { value: "REPORT", label: "Отчёт", color: "grape" },
  { value: "SELL", label: "Продам", color: "teal" },
  { value: "BUY", label: "Куплю", color: "cyan" },
] as const

export type TopicPrefix = (typeof TOPIC_PREFIXES)[number]["value"]

/** Метка, которую ставит система: тема с отмеченным ответом. */
export const SOLVED_PREFIX = { value: "SOLVED", label: "Решено", color: "green" } as const

const PREFIX_SET = new Set<string>(TOPIC_PREFIXES.map((item) => item.value))

export function isTopicPrefix(value: string): value is TopicPrefix {
  return PREFIX_SET.has(value)
}

/** Подпись и цвет метки для показа. */
export function topicPrefixMeta(prefix: string | null, hasBestAnswer: boolean) {
  /* Решённый вопрос перебивает исходную метку: человеку, который ищет
     ответ, важнее «Решено», чем то, что когда-то просили помощи. */
  if (hasBestAnswer) return SOLVED_PREFIX
  if (!prefix) return null
  return TOPIC_PREFIXES.find((item) => item.value === prefix) || null
}

/* Сколько времени автор может править своё сообщение.

   Не бессрочно: разговор строится на том, что написано. Если через год
   переписать ответ, на который сослались десять человек, ветка потеряет
   смысл, а согласившиеся окажутся согласны с чужим текстом. Сутки
   покрывают всё, ради чего правка нужна на деле: опечатка, забытая
   фотография, уточнение после первого ответа. */
export const POST_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000

export type PostEditPermission =
  | { allowed: true }
  | { allowed: false; reason: string }

/**
 * Может ли человек править это сообщение.
 *
 * Модератор правит без ограничения по времени: он чистит спам и
 * запрещённое, а это находят и через месяц.
 */
export function canEditPost(input: {
  postAuthorId: string
  postCreatedAt: Date
  postDeleted: boolean
  topicClosed: boolean
  viewerId: string | null
  viewerIsModerator?: boolean
  now?: Date
}): PostEditPermission {
  if (!input.viewerId) return { allowed: false, reason: "Требуется вход" }
  if (input.postDeleted) return { allowed: false, reason: "Сообщение удалено" }

  if (input.viewerIsModerator) return { allowed: true }

  if (input.postAuthorId !== input.viewerId) {
    return { allowed: false, reason: "Править можно только свои сообщения" }
  }
  /* Закрытая тема не правится и автором: закрывают её как раз тогда,
     когда разговор пора остановить. */
  if (input.topicClosed) return { allowed: false, reason: "Тема закрыта" }

  const age = (input.now?.getTime() ?? Date.now()) - input.postCreatedAt.getTime()
  if (age > POST_EDIT_WINDOW_MS) {
    return { allowed: false, reason: "Править можно в течение суток после публикации" }
  }

  return { allowed: true }
}

/**
 * Транслитерация для адреса.
 *
 * Кириллица в адресе превращается в проценты и нечитаема ни человеком, ни
 * в ссылке, отправленной другу.
 */
function transliterate(value: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh",
    щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  }
  return value.split("").map((char) => {
    const lower = char.toLowerCase()
    const mapped = map[lower]
    if (mapped === undefined) return char
    return char === lower ? mapped : mapped.toUpperCase()
  }).join("")
}

/** «14 ответов» — с русским склонением. */
export function pluralReplies(count: number): string {
  const lastTwo = count % 100
  const lastOne = count % 10
  if (lastTwo >= 11 && lastTwo <= 14) return "ответов"
  if (lastOne === 1) return "ответ"
  if (lastOne >= 2 && lastOne <= 4) return "ответа"
  return "ответов"
}

/** «12 тем» — с русским склонением. */
export function pluralTopics(count: number): string {
  const lastTwo = count % 100
  const lastOne = count % 10
  if (lastTwo >= 11 && lastTwo <= 14) return "тем"
  if (lastOne === 1) return "тема"
  if (lastOne >= 2 && lastOne <= 4) return "темы"
  return "тем"
}

/**
 * Раздел форума по марке автомобиля.
 *
 * Карточка машины и форум живут порознь: человек смотрит Haval Jolion и
 * не знает, что о нём уже спрашивали. Сопоставление даёт ссылку прямо с
 * карточки — и посетителю польза, и форуму жизнь.
 *
 * Список неполный намеренно: марки без своего раздела ссылки не
 * получают. Отправлять человека в «Европейские прочие» с вопросом про
 * конкретную машину — обманывать ожидание.
 */
const MAKE_SECTIONS: Readonly<Record<string, string>> = {
  toyota: "toyota", lexus: "lexus",
  nissan: "nissan", honda: "honda", mazda: "mazda",
  subaru: "subaru", mitsubishi: "mitsubishi",
  suzuki: "suzuki-isuzu", isuzu: "suzuki-isuzu",

  volkswagen: "volkswagen", vw: "volkswagen",
  bmw: "bmw", "mercedes-benz": "mercedes", mercedes: "mercedes", audi: "audi",
  opel: "opel-porsche", porsche: "opel-porsche",

  hyundai: "hyundai", kia: "kia",
  genesis: "genesis-ssangyong", ssangyong: "genesis-ssangyong",

  haval: "haval", chery: "chery-exeed", exeed: "chery-exeed",
  geely: "geely", changan: "changan-omoda", omoda: "changan-omoda",
  jaecoo: "changan-omoda", zeekr: "li-zeekr-byd", byd: "li-zeekr-byd",

  ford: "ford-chevrolet", chevrolet: "ford-chevrolet",
  jeep: "jeep-dodge-tesla", dodge: "jeep-dodge-tesla", tesla: "jeep-dodge-tesla",

  lada: "lada", ваз: "lada", уаз: "uaz-gaz", газ: "uaz-gaz",
  москвич: "moskvich-retro",

  renault: "renault-peugeot-citroen", peugeot: "renault-peugeot-citroen",
  citroen: "renault-peugeot-citroen",
  skoda: "skoda-volvo", volvo: "skoda-volvo",
}

/** Адрес раздела форума для марки; null — своего раздела нет. */
export function forumSectionForMake(make: string | null | undefined): string | null {
  if (!make) return null
  const key = make.trim().toLowerCase().replace(/\s+/g, "-")
  return MAKE_SECTIONS[key] ?? null
}
