import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { REPORT_COMMENT_MAX, REPORT_REASONS, canReportPost, isReportReason, reportReasonLabel, validateReport } from "../src/lib/forum-reports.ts"

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8")

// === Жалобы ===

test("список причин короткий", () => {
  /* Длинный перечень человек не читает, а выбирает первый пункт, и
     очередь модератора наполняется жалобами «прочее» без пояснений. */
  assert.ok(REPORT_REASONS.length <= 6, `причин стало ${REPORT_REASONS.length}`)
})

test("выдуманная причина не проходит", () => {
  assert.equal(isReportReason("НЕ_НРАВИТСЯ"), false)
  assert.equal(isReportReason("__proto__"), false)
  assert.equal(validateReport({ reason: "НЕ_НРАВИТСЯ" }).ok, false)
})

test("«Другое» требует пояснения", () => {
  // Без него модератору нечего разбирать.
  assert.equal(validateReport({ reason: "OTHER" }).ok, false)
  assert.equal(validateReport({ reason: "OTHER", comment: "рекламирует свой сервис" }).ok, true)
})

test("«опасный совет» требует пояснения", () => {
  /* Без него модератор не отличит неверную рекомендацию от несогласия с
     ней, а на форуме о технике это разные вещи. */
  const empty = validateReport({ reason: "WRONG" })
  assert.equal(empty.ok, false)
  if (!empty.ok) assert.match(empty.error, /опасен/)
  assert.equal(validateReport({ reason: "WRONG", comment: "советует ездить без тормозной жидкости" }).ok, true)
})

test("спам не требует пояснения", () => {
  // Реклама видна сама, и заставлять описывать её — лишний барьер.
  assert.equal(validateReport({ reason: "SPAM" }).ok, true)
})

test("пустое пояснение сохраняется как отсутствующее", () => {
  const result = validateReport({ reason: "SPAM", comment: "   " })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.comment, null)
})

test("длинное пояснение отклоняется", () => {
  const long = "а".repeat(REPORT_COMMENT_MAX + 1)
  assert.equal(validateReport({ reason: "SPAM", comment: long }).ok, false)
})

test("на своё сообщение пожаловаться нельзя", () => {
  // Если написал не то — есть правка; жалоба на себя занимает очередь.
  assert.equal(canReportPost({ postAuthorId: "u1", viewerId: "u1", postDeleted: false }), false)
  assert.equal(canReportPost({ postAuthorId: "u1", viewerId: "u2", postDeleted: false }), true)
})

test("гость не жалуется", () => {
  assert.equal(canReportPost({ postAuthorId: "u1", viewerId: null, postDeleted: false }), false)
})

test("на удалённое сообщение жаловаться нечего", () => {
  assert.equal(canReportPost({ postAuthorId: "u1", viewerId: "u2", postDeleted: true }), false)
})

test("подпись причины находится по значению", () => {
  assert.equal(reportReasonLabel("SPAM"), "Реклама или спам")
  // Неизвестное значение возвращается как есть, а не теряется.
  assert.equal(reportReasonLabel("НЕЧТО"), "НЕЧТО")
})

test("повторная жалоба не считается сбоем", () => {
  // Она уже в очереди — человеку так и надо сказать.
  const route = read("../src/app/api/forum/reports/route.ts")
  assert.match(route, /P2002/)
  assert.match(route, /Вы уже пожаловались/)
})

test("одна жалоба от человека на сообщение", () => {
  /* Десять жалоб от одного не делают проблему серьёзнее, а очередь
     модератора засоряют. */
  const migration = read("../prisma/migrations/20260828090000_forum_subscriptions/migration.sql")
  assert.match(migration, /CREATE UNIQUE INDEX "ForumReport_postId_authorId_key"/)
})

// === Подписки ===

const store = read("../src/lib/forum-subscriptions.ts")
const migration = read("../prisma/migrations/20260828090000_forum_subscriptions/migration.sql")

test("автор подписан на свою тему с создания", () => {
  /* Он задал вопрос и ждёт ответа больше всех, а требовать отдельного
     нажатия — значит потерять его же. */
  const route = read("../src/app/api/forum/topics/route.ts")
  assert.match(route, /subscriptions: \{ create: \{ userId: session\.user\.id \} \}/)
})

test("существующие темы получили подписку автора", () => {
  // Иначе подписки появились бы только у тем, созданных после правки.
  assert.match(migration, /INSERT INTO "ForumSubscription"[\s\S]*?FROM "ForumTopic"/)
})

test("написавший не получает уведомление о себе", () => {
  // Он только что видел свой текст.
  assert.match(store, /userId: \{ not: input\.authorId \}/)
})

test("уведомление называет тему", () => {
  /* «Вам ответили» без указания темы ничего не говорит, когда подписок
     десяток. */
  assert.match(store, /input\.topicTitle/)
})

test("сбой уведомлений не отменяет ответ", () => {
  /* Ответ уже написан и сохранён, а не дошедшее уведомление — потеря
     меньшая, чем потерянный текст. */
  assert.match(store, /catch \(error\)[\s\S]*?console\.error\("Уведомления подписчикам темы:"/)
  const posts = read("../src/app/api/forum/posts/route.ts")
  // Вызов не ждут: рассылка по двум сотням не должна держать ответ.
  assert.match(posts, /void notifyTopicSubscribers\(/)
})

test("рассылка идёт после транзакции, а не внутри", () => {
  const posts = read("../src/app/api/forum/posts/route.ts")
  const transactionEnd = posts.indexOf("return created")
  /* Ищем именно вызов, а не импорт: имя встречается и в строке import
     в самом начале файла. */
  const notifyAt = posts.indexOf("void notifyTopicSubscribers(")
  assert.ok(notifyAt > transactionEnd, "уведомления вызываются внутри сделки")
})

test("одна подписка на человека и тему", () => {
  assert.match(migration, /CREATE UNIQUE INDEX "ForumSubscription_topicId_userId_key"/)
})

test("подписка гостю не показывается", () => {
  const page = read("../src/app/forum/[section]/[topic]/page.tsx")
  assert.match(page, /viewerId && \([\s\S]{0,200}SubscribeButton/)
})

// === Очередь жалоб у модератора ===

const adminRoute = read("../src/app/api/admin/forum-reports/route.ts")

test("очередь жалоб закрыта от посторонних", () => {
  assert.match(adminRoute, /requireModeratorSession/)
})

test("неразобранные показываются первыми", () => {
  /* Разобранные нужны редко, и держать их вперемешку значит заставлять
     модератора искать работу глазами. */
  assert.match(adminRoute, /resolved \? \{ resolvedAt: \{ not: null \} \} : \{ resolvedAt: null \}/)
})

test("удаление сообщения закрывает жалобу одной сделкой", () => {
  /* Жалоба, оставшаяся открытой при удалённом сообщении, вернётся в
     очередь второй раз. */
  const deleteBlock = adminRoute.slice(adminRoute.indexOf('action === "delete-post"'))
  assert.match(deleteBlock, /\$transaction/)
  assert.match(deleteBlock, /deletedAt: new Date\(\)/)
  assert.match(deleteBlock, /resolvedAt: new Date\(\)/)
})

test("удаление уменьшает счётчик сообщений автора", () => {
  // Удалённое сообщение не должно продолжать работать на его репутацию.
  const deleteBlock = adminRoute.slice(
    adminRoute.indexOf('action === "delete-post"'),
    adminRoute.indexOf('action === "restore-post"'),
  )
  assert.match(deleteBlock, /forumPostCount: \{ decrement: 1 \}/)
})

test("восстановление возвращает счётчик", () => {
  // Иначе после ошибочного удаления число у автора останется заниженным.
  const restoreBlock = adminRoute.slice(adminRoute.indexOf('action === "restore-post"'))
  assert.match(restoreBlock, /forumPostCount: \{ increment: 1 \}/)
  assert.match(restoreBlock, /deletedAt: null/)
})

test("удаление мягкое", () => {
  /* На месте сообщения остаётся пометка, иначе ответы на него теряют
     смысл. */
  assert.doesNotMatch(adminRoute, /forumPost\.delete\(/)
})

test("неизвестное действие отклоняется", () => {
  assert.match(adminRoute, /Неизвестное действие/)
})

test("раздел форума есть в меню админки", () => {
  // Без ссылки очередь никто не найдёт.
  const nav = read("../src/components/admin/AdminWorkspaceNavigation.tsx")
  assert.match(nav, /href: "\/admin\/forum"/)
})

test("из очереди можно перейти к сообщению", () => {
  // Разбирать жалобу, не видя разговора вокруг, нельзя.
  const page = read("../src/app/admin/forum/page.tsx")
  assert.match(page, /#post-\$\{report\.post\.id\}/)
})

// === Модерация тем ===

const topicRoute = read("../src/app/api/admin/forum-topics/route.ts")

test("модерация тем закрыта от посторонних", () => {
  assert.match(topicRoute, /requireModeratorSession/)
})

test("перенос двигает счётчики обоих разделов одной сделкой", () => {
  /* Разъедься они, и в списке разделов будет «12 тем» там, где их
     одиннадцать, а восстановить правду можно только полным пересчётом. */
  const moveBlock = topicRoute.slice(topicRoute.indexOf('action === "move"'))
  assert.match(moveBlock, /\$transaction/)
  assert.match(moveBlock, /topicCount: \{ decrement: 1 \}, postCount: \{ decrement: postCount \}/)
  assert.match(moveBlock, /topicCount: \{ increment: 1 \}, postCount: \{ increment: postCount \}/)
})

test("сообщения считаются один раз", () => {
  // Два подсчёта одного и того же — лишний запрос и повод разойтись.
  const moveBlock = topicRoute.slice(topicRoute.indexOf('action === "move"'))
  const counts = moveBlock.match(/forumPost\.count/g) || []
  assert.equal(counts.length, 1, `подсчётов сообщений: ${counts.length}`)
})

test("перенос в тот же раздел отклоняется", () => {
  assert.match(topicRoute, /Тема уже в этом разделе/)
})

test("после переноса человек попадает на новый адрес", () => {
  /* Адрес темы содержит раздел: прежний после переноса ведёт в никуда. */
  const panel = read("../src/components/forum/TopicModeration.tsx")
  assert.match(panel, /router\.replace\(`\/forum\/\$\{payload\.sectionSlug\}\/\$\{payload\.slug\}`\)/)
})

test("разделы для переноса тянутся только модератору", () => {
  // Сотня строк в списке не нужна тем, кто просто читает тему.
  const page = read("../src/app/forum/[section]/[topic]/page.tsx")
  assert.match(page, /isModer\s*\n?\s*\? await prisma\.forumSection\.findMany/)
})

test("неизвестное действие над темой отклоняется", () => {
  assert.match(topicRoute, /Неизвестное действие/)
})
