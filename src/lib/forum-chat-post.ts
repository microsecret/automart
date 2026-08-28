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
  /** Ответов ещё нет: пост честно зовёт ответить, а не притворяется
      живым обсуждением. */
  awaitingAnswer?: boolean
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
  } else if (topic.awaitingAnswer) {
    /* Честно, а не «присоединяйтесь к обсуждению»: человек перейдёт и
       увидит вопрос без единого ответа, и обман запомнится. */
    lines.push("", "❓ Вопрос пока без ответа — подскажете?")
  }

  lines.push("", `<i>${escapeHtml(topic.sectionTitle)} · ${escapeHtml(topic.authorName || "Участник")}</i>`)

  let caption = lines.join("\n")
  if (caption.length > CAPTION_LIMIT) {
    /* Обрезаем по границе строки, а не посреди слова: оборванная на
       полуслове подпись читается как сбой. */
    caption = caption.slice(0, CAPTION_LIMIT - 1).replace(/\n[^\n]*$/, "")
  }

  const buttons: { text: string; url: string }[] = []

  /* Ссылка на тему первой: за ней человек и нажимает.

     Раньше здесь стояло «t.me/<бот>?startapp=forum_…», но Telegram
     отвечает на неё «bot invalid»: она работает только у ботов с
     настроенным главным мини-приложением, а у нашего его нет — getMe
     отдаёт «has_main_web_app: false», приложение подключено кнопкой
     меню. Настраивается это в BotFather, кодом не исправить. */
  buttons.push({
    text: topic.hasPoll ? "📊 Ответить в теме" : "💬 Открыть обсуждение",
    url: `${site}${topicPath}?from=telegram`,
  })

  /* Приложение — отдельной кнопкой: оно открывает форум целиком, а не
     эту тему, и как способ прочитать обсуждение проигрывает прямой
     ссылке выше. */
  if (options.botUsername) {
    buttons.push({ text: "📱 Открыть приложение", url: `https://t.me/${options.botUsername}` })
  }

  return { photos, caption, buttons }
}
