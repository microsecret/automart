import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { MAX_TOPIC_PHOTOS, buildForumChatPost } from "../src/lib/forum-chat-post.ts"

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")

const base = {
  title: "Стук в подвеске Haval Jolion",
  excerpt: "Появился стук спереди справа на неровностях. Что смотреть первым?",
  authorName: "Механик",
  sectionTitle: "Haval",
  sectionSlug: "haval",
  topicSlug: "stuk-v-podveske-haval-jolion-a1b2c3",
  images: [] as string[],
  hasPoll: false,
}
const options = { botUsername: "lewheel_bot", siteUrl: "https://lewheel.ru/" }

test("в посте есть заголовок, текст и раздел", () => {
  const post = buildForumChatPost(base, options)
  assert.match(post.caption, /Стук в подвеске/)
  assert.match(post.caption, /Что смотреть первым/)
  assert.match(post.caption, /Haval/)
  assert.match(post.caption, /Механик/)
})

test("кнопка приложения ведёт на тему с разделом", () => {
  /* Адрес темы содержит раздел: без него страница отвечает «не
     найдено». */
  const post = buildForumChatPost(base, options)
  const app = post.buttons.find((b) => /приложении/.test(b.text))
  assert.ok(app, "кнопки приложения нет")
  assert.match(app.url, /startapp=forum_haval__stuk-v-podveske-haval-jolion-a1b2c3/)
})

test("кнопка сайта ведёт на полный адрес темы", () => {
  const post = buildForumChatPost(base, options)
  const site = post.buttons.find((b) => /сайте/.test(b.text))
  assert.ok(site)
  assert.equal(site.url, "https://lewheel.ru/forum/haval/stuk-v-podveske-haval-jolion-a1b2c3")
})

test("без имени бота остаётся только ссылка на сайт", () => {
  // Ссылка вида «https://t.me/undefined» просто не откроется.
  const post = buildForumChatPost(base, { siteUrl: "https://lewheel.ru/" })
  assert.equal(post.buttons.length, 1)
  assert.match(post.buttons[0].text, /сайте/)
})

test("про опрос сказано отдельно", () => {
  /* Голосование — самое лёгкое действие, на которое соглашается человек,
     который читать не собирался. */
  const post = buildForumChatPost({ ...base, hasPoll: true }, options)
  assert.match(post.caption, /голосование/i)
  const app = post.buttons.find((b) => /приложении/.test(b.text))
  assert.ok(app, "кнопки приложения нет")
  assert.match(app.text, /Ответить/)
})

test("теги из заголовка не проходят в пост", () => {
  /* Заголовок пишет человек, а подпись уходит с разметкой HTML: без
     экранирования чужой тег попал бы в чат как разметка. */
  const post = buildForumChatPost({ ...base, title: "<b>Спам</b> <script>alert(1)</script>" }, options)
  assert.doesNotMatch(post.caption.replace(/<b>|<\/b>|<i>|<\/i>/g, ""), /<script|<b>Спам/)
  assert.match(post.caption, /&lt;script&gt;/)
})

test("не больше девяти фотографий", () => {
  const many = Array.from({ length: 20 }, (_, i) => `/uploads/photo-${i}.jpg`)
  const post = buildForumChatPost({ ...base, images: many }, options)
  assert.equal(post.photos.length, MAX_TOPIC_PHOTOS)
})

test("длинная подпись обрезается по границе строки", () => {
  // Оборванная на полуслове подпись читается как сбой.
  const post = buildForumChatPost({ ...base, excerpt: "а".repeat(3000) }, options)
  assert.ok(post.caption.length <= 1024, `подпись ${post.caption.length}`)
})

test("безымянный автор не ломает пост", () => {
  const post = buildForumChatPost({ ...base, authorName: null }, options)
  assert.match(post.caption, /Участник/)
})

// === Рассылка ===

const broadcast = read("../src/lib/forum-chat-broadcast.ts")

test("не чаще одной темы в сутки на чат", () => {
  /* Чат не лента форума: пришли туда за объявлениями, и поток обсуждений
     читается как спам. */
  assert.match(broadcast, /CHAT_INTERVAL_MS = 24 \* 60 \* 60 \* 1000/)
  assert.match(broadcast, /publishedAt: \{ gt: new Date\(now\.getTime\(\) - CHAT_INTERVAL_MS\) \}/)
})

test("темы с ответами идут первыми", () => {
  /* Разговор, который уже пошёл, интереснее вопроса без ответа. Но если
     таких тем нет вовсе, рассылка не должна вставать: иначе круг
     замыкается — людей не зовём, потому что не отвечают, а не отвечают,
     потому что не зовём. */
  assert.match(broadcast, /replyCount: \{ gte: PREFERRED_REPLIES \}/)
  assert.match(broadcast, /\?\? await prisma\.forumTopic\.findFirst/)
})

test("тема без ответов честно названа вопросом", () => {
  /* Человек перейдёт и увидит вопрос без единого ответа — обман
     запомнится. */
  const post = buildForumChatPost({ ...base, awaitingAnswer: true }, options)
  assert.match(post.caption, /без ответа/)
})

test("закрытые и удалённые темы не рассылаются", () => {
  assert.match(broadcast, /isClosed: false/)
  assert.match(broadcast, /deletedAt: null/)
})

test("одна тема не уходит в тот же чат дважды", () => {
  assert.match(broadcast, /chatPosts: \{ none: \{ chatId: chat\.id \} \}/)
  const migration = read("../prisma/migrations/20260828170000_forum_chat_post/migration.sql")
  assert.match(migration, /CREATE UNIQUE INDEX "ForumChatPost_topicId_chatId_key"/)
})

test("приложение понимает адрес темы", () => {
  const miniApp = read("../src/components/telegram/TelegramMiniApp.tsx")
  assert.match(miniApp, /FORUM_PARAM/)
  assert.match(miniApp, /\/forum\/\$\{forum\[1\]\}\/\$\{forum\[2\]\}/)
})

test("чужая строка в адресе темы никуда не уводит", () => {
  const miniApp = read("../src/components/telegram/TelegramMiniApp.tsx")
  const pattern = miniApp.match(/const FORUM_PARAM = (\/[^\n]+\/i)/)?.[1]
  assert.ok(pattern, "проверки параметра нет")

  const rule = new RegExp(pattern.slice(1, -2), "i")
  assert.ok(rule.test("forum_haval__stuk-a1b2c3"), "настоящий адрес отклонён")
  for (const bad of ["forum_../../admin__x", "forum_haval__<script>", "forum_haval__../etc"]) {
    assert.ok(!rule.test(bad), `пропущено: ${bad}`)
  }
})

test("отправка идёт через общий модуль", () => {
  /* Тот же порядок, что у объявлений: держать его в двух местах значит
     однажды поправить одно и забыть про другое. */
  assert.match(broadcast, /sendChatPost/)
  assert.match(broadcast, /buttonsCaption: "Читать обсуждение:"/)
})

test("пришедшему из чата показан путь, а не тупик", () => {
  /* Человек из чата входа по паролю не проходил: у него его просто нет.
     Отправлять его на форму пароля — тупик, из которого он уходит. */
  const form = read("../src/app/forum/[section]/[topic]/ReplyForm.tsx")
  assert.match(form, /fromTelegram/)
  assert.match(form, /https:\/\/t\.me\/\$\{botUsername\}/)
  assert.match(form, /три шага/)
})

test("признак чата читается после отрисовки", () => {
  /* На сервере адреса нет, и проверка прямо в разметке дала бы мигание:
     сначала общий текст, потом нужный. */
  const form = read("../src/app/forum/[section]/[topic]/ReplyForm.tsx")
  assert.match(form, /useEffect\(\(\) => \{\s*setFromTelegram/)
})
