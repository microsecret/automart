/**
 * Пост обсуждения для чатов сети.
 *
 * Форум с тринадцатью темами не растёт сам: человек не заходит проверять
 * площадку, о которой не помнит. А в чатах уже сидят те, кому вопрос
 * интересен — их надо позвать, а не ждать.
 *
 * Здесь только сборка текста и кнопок, без сети и базы: то, что уйдёт
 * посторонним людям, должно проверяться тестами.
 */

/** Ограничение Telegram на подпись под фотографией. */
const CAPTION_LIMIT = 1024

/** Столько же, сколько у объявления: больше девяти Telegram не принимает. */
export const MAX_TOPIC_PHOTOS = 9

export type ForumTopicPost = {
  title: string
  /** Первое сообщение — уже без пометок разметки. */
  excerpt: string
  authorName: string | null
  sectionTitle: string
  sectionSlug: string
  topicSlug: string
  /** Картинки из первого сообщения: их вытаскивает вызывающий. */
  images: string[]
  /** Есть ли в теме опрос — про него стоит сказать отдельно. */
  hasPoll: boolean
}

export type ChatTopicPost = {
  photos: string[]
  caption: string
  buttons: { text: string; url: string }[]
}

/** Экранирование: заголовок и текст пишет человек, а подпись идёт с HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/**
 * Собирает пост обсуждения.
 *
 * Порядок продуман: сначала раздел мелким шрифтом — по нему человек
 * решает, его ли это тема; потом заголовок; потом отрывок. Вопрос в конце
 * зовёт ответить, а не просто посмотреть.
 */
export function buildForumChatPost(
  topic: ForumTopicPost,
  options: { botUsername?: string; siteUrl: string },
): ChatTopicPost {
  const photos = topic.images
    .filter((url) => typeof url === "string" && url.length > 0)
    .slice(0, MAX_TOPIC_PHOTOS)

  const site = options.siteUrl.replace(/\/$/, "")
  const topicPath = `/forum/${topic.sectionSlug}/${topic.topicSlug}`

  const lines = [
    `💬 <b>${escapeHtml(topic.title)}</b>`,
    "",
    escapeHtml(topic.excerpt),
  ]

  if (topic.hasPoll) {
    /* Про опрос сказано отдельно: голосование — самое лёгкое действие,
       на которое соглашается человек, который читать не собирался. */
    lines.push("", "📊 В теме идёт голосование — можно ответить одним нажатием.")
  }

  lines.push("", `<i>${escapeHtml(topic.sectionTitle)} · ${escapeHtml(topic.authorName || "Участник")}</i>`)

  let caption = lines.join("\n")
  if (caption.length > CAPTION_LIMIT) {
    /* Обрезаем по границе строки, а не посреди слова: оборванная на
       полуслове подпись читается как сбой. */
    caption = caption.slice(0, CAPTION_LIMIT - 1).replace(/\n[^\n]*$/, "")
  }

  const buttons: { text: string; url: string }[] = []

  /* Открытие в приложении первым: из чата человек уже в Telegram, и
     приложение открывается прямо здесь, а ссылка на сайт выбрасывает его
     в браузер, где он заново входит в учётную запись. */
  if (options.botUsername) {
    buttons.push({
      text: topic.hasPoll ? "📊 Ответить в приложении" : "💬 Ответить в приложении",
      /* Раздел и тема вместе: адрес темы содержит раздел, и без него
         страница отвечает «не найдено». Разделитель «__» — двойное
         подчёркивание: одинарное встречается в самих адресах. */
      url: `https://t.me/${options.botUsername}?startapp=forum_${topic.sectionSlug}__${topic.topicSlug}`,
    })
  }

  buttons.push({ text: "🔎 Открыть на сайте", url: `${site}${topicPath}` })

  return { photos, caption, buttons }
}
