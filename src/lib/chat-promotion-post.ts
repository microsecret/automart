/**
 * Пост объявления для сети Telegram-чатов.
 *
 * Пост уходит в одиннадцать региональных групп со ста четырнадцатью
 * тысячами подписчиков — это не служебное сообщение, а витрина
 * площадки. Плохо собранный пост здесь стоит дороже, чем плохая
 * страница на сайте: его видят люди, которые о площадке ещё не знают.
 *
 * Сборка вынесена отдельно от отправки, потому что проверять текст,
 * порядок фото и подписи кнопок нужно без сети и без бота.
 */

/** Telegram допускает не больше десяти вложений в альбоме; берём девять. */
export const MAX_POST_PHOTOS = 9

/** Ограничение подписи к альбому в Telegram. */
const CAPTION_LIMIT = 1024

export type PromotedListing = {
  id: string
  title: string
  price: number
  city?: string | null
  year?: number | null
  mileage?: number | null
  fuelType?: string | null
  transmission?: string | null
  power?: number | null
  images: string[]
  /** Идентификатор продавца в Telegram — для кнопки «Написать». */
  sellerTelegramId?: string | null
}

export type PostButton = { text: string; url: string }

export type ChatPost = {
  /** До девяти адресов фотографий для альбома. */
  photos: string[]
  /** Подпись под альбомом или самостоятельное сообщение. */
  caption: string
  buttons: PostButton[]
}

/** Экранирование под HTML-разметку Telegram. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** «2 350 000 ₽». Разряды toLocaleString уже разделяет неразрывным
   пробелом, поэтому цена не рвётся на переносе строки. */
function formatPrice(price: number): string {
  return `${Math.round(price).toLocaleString("ru-RU")} ₽`
}

/**
 * Коробка и топливо по-русски.
 *
 * В базе они хранятся кодами, и пост уходил в чаты со строкой
 * «MANUAL · GASOLINE» — латиницей, машинными словами. Подписчик в чате
 * Казани читает объявление на своём языке, а не в терминах базы.
 *
 * Словарь продублирован строками, а не взят из constants: этот модуль
 * проверяется тестовым запускателем node, который не разбирает
 * псевдоним «@/», и связывать витрину с деревом импортов приложения
 * незачем — здесь всего десять пар.
 *
 * «OTHER» переводится не «Другая», а в пустоту: это отсутствие
 * сведений, а не характеристика. Строка «⚙️ 2010 г. · Другая · Другое»
 * не говорит ничего, а место занимает.
 */
const SPEC_LABELS: Record<string, string> = {
  MANUAL: "механика",
  AUTOMATIC: "автомат",
  VARIATOR: "вариатор",
  ROBOTIC: "робот",
  GASOLINE: "бензин",
  PETROL: "бензин",
  DIESEL: "дизель",
  ELECTRIC: "электро",
  HYBRID: "гибрид",
  GAS: "газ",
}

/**
 * Переводит код характеристики.
 *
 * Готовое русское слово проходит как есть: часть источников отдаёт
 * «Автомат» вместо «AUTOMATIC», и отбрасывать его было бы потерей
 * настоящих сведений.
 *
 * Неизвестный латинский код не показывается: молчание честнее
 * английского слова посреди русского объявления.
 */
function specLabel(code: string | null | undefined): string | null {
  if (typeof code !== "string") return null
  const value = code.trim()
  if (!value) return null

  const known = SPEC_LABELS[value.toUpperCase()]
  if (known) return known

  /* Кириллица — уже готовая подпись, а не код из базы. */
  if (/[а-яё]/i.test(value)) return value

  return null
}

/** «165 000 км». */
function formatMileage(mileage: number): string {
  return `${Math.round(mileage).toLocaleString("ru-RU")} км`
}

/**
 * Собирает пост объявления.
 *
 * Порядок продуман: сначала цена — по ней человек решает, читать ли
 * дальше; потом название и характеристики строкой; город отдельно, он
 * определяет, поедет ли покупатель смотреть.
 *
 * Выдуманных данных в посте нет: отсутствующее поле просто не
 * показывается. Пост уходит незнакомым людям, и неверная характеристика
 * здесь — обман, а не неточность.
 */
export function buildChatPost(listing: PromotedListing, options: { botUsername?: string; siteUrl: string }): ChatPost {
  const photos = listing.images.filter((url) => typeof url === "string" && url.length > 0).slice(0, MAX_POST_PHOTOS)

  const specs: string[] = []
  if (listing.year) specs.push(`${listing.year} г.`)
  if (listing.mileage) specs.push(formatMileage(listing.mileage))
  if (listing.power) specs.push(`${Math.round(listing.power)} л.с.`)
  const transmission = specLabel(listing.transmission)
  if (transmission) specs.push(escapeHtml(transmission))
  const fuel = specLabel(listing.fuelType)
  if (fuel) specs.push(escapeHtml(fuel))

  const lines: string[] = [
    `🚗 <b>${escapeHtml(listing.title)}</b>`,
    "",
    `💰 <b>${formatPrice(listing.price)}</b>`,
  ]

  if (specs.length) lines.push(`⚙️ ${specs.join(" · ")}`)
  if (listing.city) lines.push(`📍 ${escapeHtml(listing.city)}`)

  lines.push("", "👇 Напишите продавцу прямо из чата")

  let caption = lines.join("\n")
  /* Подпись длиннее лимита Telegram обрезается самим мессенджером в
     произвольном месте — лучше обрезать самим, по границе строки. */
  if (caption.length > CAPTION_LIMIT) {
    caption = caption.slice(0, CAPTION_LIMIT - 1).replace(/\n[^\n]*$/, "")
  }

  const listingUrl = `${options.siteUrl.replace(/\/$/, "")}/listings/vehicle/${listing.id}`

  const buttons: PostButton[] = []

  /* Открытие объявления первым: за ним человек и нажимает.

     Ссылка «t.me/<бот>?startapp=» здесь не годится — Telegram отвечает
     «bot invalid». Она работает только у ботов с настроенным главным
     мини-приложением, а у нашего его нет: getMe отдаёт
     «has_main_web_app: false», приложение подключено кнопкой меню.
     Настраивается это в BotFather, кодом не исправить.

     Поэтому кнопка ведёт на сайт. Для человека из чата это на один шаг
     дальше, чем приложение, но эта дверь по крайней мере открывается. */
  buttons.push({ text: "🔎 Открыть объявление", url: listingUrl })

  /* Написать продавцу — через страницу объявления.

     Ссылка «t.me/<бот>?start=listing_...» вела в бот, но бот такого
     параметра не понимает: на любой /start он отвечает шагом
     регистрации. Человек нажимал «Написать продавцу» и получал анкету.

     Прямую ссылку на продавца ставить нельзя: она раскрыла бы его
     аккаунт всем читателям чата, включая тех, кто машиной не
     интересуется. */
  if (listing.sellerTelegramId) {
    buttons.push({
      text: "✉️ Написать продавцу",
      url: `${listingUrl}?from=telegram`,
    })
  }

  /* Приложение — отдельной кнопкой и последним: оно открывает каталог, а
     не это объявление, и как способ посмотреть машину проигрывает
     прямой ссылке выше. */
  if (options.botUsername) {
    buttons.push({
      text: "📱 Открыть приложение",
      url: `https://t.me/${options.botUsername}`,
    })
  }

  buttons.push({
    text: "➕ Разместить своё объявление",
    url: `${options.siteUrl.replace(/\/$/, "")}/listings/create/vehicle`,
  })

  return { photos, caption, buttons }
}

/**
 * Текст рекламного поста площадки — того, что зовёт продавцов
 * подключить продвижение.
 *
 * Отделён от поста объявления: у них разные задачи. Этот обращён к
 * продавцу и говорит о выгоде, а не о конкретной машине.
 */
export function buildPromotionOfferPost(options: {
  siteUrl: string
  chatCount: number
  subscriberCount: number
  priceRub: number
}): { caption: string; buttons: PostButton[] } {
  const subscribers = options.subscriberCount.toLocaleString("ru-RU")
  const price = options.priceRub.toLocaleString("ru-RU")

  const caption = [
    "📣 <b>Продаёте машину? Мы разместим её за вас</b>",
    "",
    `Ваше объявление появится в <b>${options.chatCount} чатах</b> сети — это <b>${subscribers}</b> подписчиков в Уфе, Казани, Москве, Екатеринбурге, Тюмени и других городах.`,
    "",
    "✅ До 9 фотографий альбомом",
    "✅ Кнопка «Написать продавцу» прямо в посте",
    "✅ Закрепление поста в чате",
    "✅ Повтор публикации весь месяц",
    "",
    `💳 <b>${price} ₽ за месяц</b> — дешевле продвижения на других площадках.`,
    "",
    "Размещение объявления на сайте остаётся бесплатным.",
  ].join("\n")

  const site = options.siteUrl.replace(/\/$/, "")
  return {
    caption,
    buttons: [
      { text: "🚀 Подключить продвижение", url: `${site}/dashboard?tab=payments` },
      { text: "➕ Разместить объявление бесплатно", url: `${site}/listings/create/vehicle` },
    ],
  }
}
