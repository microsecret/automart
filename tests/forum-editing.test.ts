import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { POST_EDIT_WINDOW_MS, SOLVED_PREFIX, TOPIC_PREFIXES, canEditPost, isTopicPrefix, topicPrefixMeta } from "../src/lib/forum.ts"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { buildQuote } from "../src/lib/forum-quote.ts"

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")

// === Правка сообщения ===

const hour = 60 * 60 * 1000
const base = {
  postAuthorId: "author",
  postCreatedAt: new Date(Date.now() - hour),
  postDeleted: false,
  topicClosed: false,
}

test("автор правит своё сообщение в течение суток", () => {
  assert.deepEqual(canEditPost({ ...base, viewerId: "author" }), { allowed: true })
})

test("чужое сообщение править нельзя", () => {
  const result = canEditPost({ ...base, viewerId: "stranger" })
  assert.equal(result.allowed, false)
})

test("гость не правит ничего", () => {
  assert.equal(canEditPost({ ...base, viewerId: null }).allowed, false)
})

test("через сутки правка закрывается", () => {
  /* Разговор строится на том, что написано: перепиши через год ответ, на
     который сослались, и ветка потеряет смысл. */
  const old = { ...base, postCreatedAt: new Date(Date.now() - POST_EDIT_WINDOW_MS - 1000) }
  const result = canEditPost({ ...old, viewerId: "author" })
  assert.equal(result.allowed, false)
  if (!result.allowed) assert.match(result.reason, /суток/)
})

test("модератор правит и позже суток", () => {
  // Он чистит спам и запрещённое, а это находят и через месяц.
  const old = { ...base, postCreatedAt: new Date(Date.now() - 100 * 24 * hour) }
  assert.equal(canEditPost({ ...old, viewerId: "mod", viewerIsModerator: true }).allowed, true)
})

test("в закрытой теме автор не правит", () => {
  // Закрывают её как раз тогда, когда разговор пора остановить.
  assert.equal(canEditPost({ ...base, topicClosed: true, viewerId: "author" }).allowed, false)
})

test("удалённое сообщение не правится даже модератором", () => {
  assert.equal(
    canEditPost({ ...base, postDeleted: true, viewerId: "mod", viewerIsModerator: true }).allowed,
    false,
  )
})

test("метка правки отдельно от updatedAt", () => {
  /* updatedAt меняется от любого изменения строки, включая чужую отметку
     «решило вопрос» и счётчик реакций. «Изменено» должно означать правку
     текста автором. */
  const route = read("../src/app/api/forum/posts/route.ts")
  assert.match(route, /editedAt: new Date\(\)/)
  const migration = read("../prisma/migrations/20260828050000_forum_post_edit/migration.sql")
  assert.match(migration, /ADD COLUMN "editedAt"/)
})

// === Цитирование ===

test("цитата помечает каждую строку", () => {
  // Разбор цитат построчный: без пометки на каждой строке в цитату
  // попадёт только первая.
  const quote = buildQuote({ author: "Механик", text: "Проверьте ступицу" })
  for (const line of quote.trim().split("\n")) {
    assert.match(line, /^>/, `строка без пометки: ${line}`)
  }
})

test("цитата называет автора", () => {
  // Цитата без имени в длинной ветке ничего не говорит.
  assert.match(buildQuote({ author: "Механик", text: "текст" }), /\*\*Механик:\*\*/)
})

test("длинная цитата обрезается", () => {
  /* В ответ на разбор поломки на две тысячи знаков вставлять его целиком
     незачем: читатель видит его выше. */
  const long = "а".repeat(2000)
  const quote = buildQuote({ author: "Кто-то", text: long })
  assert.ok(quote.length < 400, `цитата не обрезана: ${quote.length}`)
  assert.match(quote, /…/)
})

test("цитата отделена от ответа пустой строкой", () => {
  // Иначе ответ прилипнет к цитате и станет её частью при разборе.
  assert.match(buildQuote({ author: "К", text: "т" }), /\n\n$/)
})

test("безымянный автор не ломает цитату", () => {
  assert.match(buildQuote({ author: "   ", text: "текст" }), /\*\*Участник:\*\*/)
})

// === Метки тем ===

test("список меток короткий", () => {
  // Десяток меток человек не читает, а выбирает первую попавшуюся.
  assert.ok(TOPIC_PREFIXES.length <= 6, `меток стало ${TOPIC_PREFIXES.length}`)
})

test("«Решено» ставит система, а не автор", () => {
  /* Метка, которую надо не забыть поставить руками после того, как
     вопрос решился, не ставится никогда. */
  /* Проверяется через isTopicPrefix, а не сравнением значений списка:
     тип уже исключает SOLVED, и такое сравнение TypeScript отвергает как
     заведомо ложное. */
  assert.equal(isTopicPrefix("SOLVED"), false)
  assert.equal(SOLVED_PREFIX.value, "SOLVED")
})

test("решённый вопрос перебивает исходную метку", () => {
  // Тому, кто ищет ответ, важнее «Решено», чем «Помогите».
  assert.equal(topicPrefixMeta("HELP", true)?.label, "Решено")
  assert.equal(topicPrefixMeta("HELP", false)?.label, "Помогите")
  assert.equal(topicPrefixMeta(null, true)?.label, "Решено")
  assert.equal(topicPrefixMeta(null, false), null)
})

test("выдуманная метка не проходит", () => {
  assert.equal(isTopicPrefix("СПАМ"), false)
  assert.equal(isTopicPrefix("__proto__"), false)
  assert.equal(topicPrefixMeta("СПАМ", false), null)
})

// === Ссылка на сообщение ===

test("у сообщения есть якорь и номер", () => {
  /* В длинной ветке на ответ ссылаются («смотри #12»), и без такой
     ссылки остаётся пересказывать своими словами. */
  const page = read("../src/app/forum/[section]/[topic]/page.tsx")
  assert.match(page, /id=\{`post-\$\{post\.id\}`\}/)
  assert.match(page, /href=\{`#post-\$\{post\.id\}`\}/)
})

test("номер сообщения сквозной, а не постраничный", () => {
  /* Нумерация, начинающаяся заново на каждой странице, сделала бы ссылку
     «смотри #12» бессмысленной. */
  const page = read("../src/app/forum/[section]/[topic]/page.tsx")
  assert.match(page, /const firstPostNumber = \(page - 1\) \* POSTS_PER_PAGE \+ 1/)
})

// === Поиск по форуму ===

test("поиск ищет и в заголовках, и в тексте сообщений", () => {
  /* Половина вопросов сформулирована в первом сообщении, а не в
     заголовке: «стучит спереди» в заголовке, а номер детали в тексте. */
  const page = read("../src/app/forum/search/page.tsx")
  assert.match(page, /containsAnyCase\("title", query\)/)
  assert.match(page, /containsAnyCase\("content", query\)/)
})

test("поиск учитывает кириллицу", () => {
  /* База SQLite: её LIKE не различает регистр только для латиницы, и
     «камаз» не нашёл бы «КАМАЗ». Подробности в search-terms.ts. */
  const page = read("../src/app/forum/search/page.tsx")
  assert.match(page, /from "@\/lib\/search-terms"/)
})

test("удалённые сообщения не попадают в поиск", () => {
  const page = read("../src/app/forum/search/page.tsx")
  assert.match(page, /deletedAt: null/)
})

test("слишком короткий запрос отклоняется", () => {
  // По одной букве найдётся полфорума, и выбрать в списке будет нечего.
  const page = read("../src/app/forum/search/page.tsx")
  assert.match(page, /query\.length < 3/)
  const field = read("../src/components/forum/ForumSearchField.tsx")
  assert.match(field, /query\.length < 3/)
})

test("страницы поиска не идут в поисковую выдачу", () => {
  /* Они плодят тысячи адресов с одинаковым содержимым и размывают вес
     настоящих тем. */
  const page = read("../src/app/forum/search/page.tsx")
  assert.match(page, /robots: \{ index: false/)
})

test("поиск открыт гостю", () => {
  /* Именно так на форум приходят из поисковика: требовать вход, чтобы
     посмотреть, есть ли ответ, значит терять этих людей. */
  const page = read("../src/app/forum/search/page.tsx")
  assert.doesNotMatch(page, /requireUser|getServerSession/)
})

test("поиск доступен с главной форума", () => {
  // Иначе его никто не найдёт.
  const forumPage = read("../src/app/forum/page.tsx")
  assert.match(forumPage, /<ForumSearchField/)
})
