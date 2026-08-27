import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { REACTION_KINDS, REPUTATION_WEIGHTS, canMarkBestAnswer, canReactToPost, isReactionKind, pluralTimes, reputationRank } from "../src/lib/forum-reputation.ts"

// === Виды реакций ===

test("список реакций короткий и закрытый", () => {
  /* Два десятка значков превращают ответы в ярмарку, где выбирают
     картинку, а не оценивают ответ. */
  assert.ok(REACTION_KINDS.length <= 3, `реакций стало ${REACTION_KINDS.length}`)
  assert.equal(isReactionKind("HELPFUL"), true)
  assert.equal(isReactionKind("ПОНРАВИЛОСЬ"), false)
  assert.equal(isReactionKind("__proto__"), false)
})

// === Право реагировать ===

test("на своё сообщение реагировать нельзя", () => {
  // Иначе реакция становится способом поднять репутацию из ничего.
  assert.equal(canReactToPost({ postAuthorId: "u1", viewerId: "u1", postDeleted: false }), false)
})

test("на чужое — можно", () => {
  assert.equal(canReactToPost({ postAuthorId: "u1", viewerId: "u2", postDeleted: false }), true)
})

test("гость не реагирует", () => {
  assert.equal(canReactToPost({ postAuthorId: "u1", viewerId: null, postDeleted: false }), false)
})

test("на удалённое сообщение реагировать нечем", () => {
  // Под пометкой «удалено модератором» оценивать нечего.
  assert.equal(canReactToPost({ postAuthorId: "u1", viewerId: "u2", postDeleted: true }), false)
})

// === Право отметить лучший ответ ===

test("отмечает автор темы", () => {
  assert.equal(
    canMarkBestAnswer({ topicAuthorId: "author", postAuthorId: "helper", viewerId: "author", postDeleted: false }),
    true,
  )
})

test("посторонний отметить не может", () => {
  assert.equal(
    canMarkBestAnswer({ topicAuthorId: "author", postAuthorId: "helper", viewerId: "stranger", postDeleted: false }),
    false,
  )
})

test("автор темы не отмечает собственный ответ", () => {
  /* Иначе отметка становится способом подписать своё же сообщение и
     набрать репутацию на пустом месте. */
  assert.equal(
    canMarkBestAnswer({ topicAuthorId: "author", postAuthorId: "author", viewerId: "author", postDeleted: false }),
    false,
  )
})

// === Вес репутации ===

test("отмеченный ответ весит больше реакции", () => {
  /* Собрать десяток «спасибо» под общим рассуждением легче, чем один раз
     действительно решить чужую поломку. */
  assert.ok(REPUTATION_WEIGHTS.bestAnswer > REPUTATION_WEIGHTS.reaction * 5)
})

// === Звания ===

test("новичку звания нет", () => {
  // Пустая строка под именем читается честнее, чем «Новичок».
  assert.equal(reputationRank(0), null)
  assert.equal(reputationRank(9), null)
})

test("звания растут по порогам", () => {
  assert.equal(reputationRank(10), "Участник")
  assert.equal(reputationRank(50), "Опытный")
  assert.equal(reputationRank(200), "Знаток")
  assert.equal(reputationRank(500), "Мастер")
  assert.equal(reputationRank(10_000), "Мастер")
})

// === Склонение ===

test("склонение слова «раз»", () => {
  assert.equal(pluralTimes(1), "1 раз")
  assert.equal(pluralTimes(2), "2 раза")
  assert.equal(pluralTimes(5), "5 раз")
  assert.equal(pluralTimes(11), "11 раз")
  assert.equal(pluralTimes(21), "21 раз")
  assert.equal(pluralTimes(22), "22 раза")
  assert.equal(pluralTimes(112), "112 раз")
})

// === Целостность данных ===

const store = readFileSync(new URL("../src/lib/forum-reputation-store.ts", import.meta.url), "utf8")

test("реакция, счётчик и репутация меняются одной сделкой", () => {
  /* Разъедься они — под сообщением одно число, у автора другое, и
     восстановить правду можно только пересчётом по всей базе. */
  assert.match(store, /\$transaction/)
})

test("репутация достаётся автору сообщения, а не нажавшему", () => {
  // Оценивают ответ, а не готовность оценивать.
  const reactionPart = store.slice(store.indexOf("toggleReaction"), store.indexOf("toggleBestAnswer"))
  assert.match(reactionPart, /where: \{ id: post\.authorId \}/)
})

test("прежняя отметка снимается вместе с очками", () => {
  // Иначе после смены мнения репутация осталась бы у обоих.
  assert.match(store, /decrement: REPUTATION_WEIGHTS\.bestAnswer/)
  assert.match(store, /forumBestAnswers: \{ decrement: 1 \}/)
})

test("двойная реакция не считается сбоем", () => {
  // Реакция уже стоит — это не ошибка, а гонка двух нажатий.
  assert.match(store, /P2002/)
})

test("уникальность реакции стоит в базе", () => {
  /* Два нажатия подряд уходят двумя запросами одновременно, и проверка в
     коде пропустила бы оба. */
  const migration = readFileSync(
    new URL("../prisma/migrations/20260828010000_forum_reactions/migration.sql", import.meta.url),
    "utf8",
  )
  assert.match(migration, /CREATE UNIQUE INDEX "ForumReaction_postId_userId_kind_key"/)
})

test("реакции страницы читаются одним запросом", () => {
  // Двадцать сообщений — двадцать обращений там, где хватает одного.
  assert.match(store, /postId: \{ in: postIds \}/)
})

test("чужие реакции поимённо наружу не выходят", () => {
  /* Кто именно нажал, на форуме о марках становится поводом для придирок
     к человеку, а не к его доводам. */
  const loadPart = store.slice(store.indexOf("export async function loadPostReactions"))
  /* Из базы userId читается — иначе не отличить свою реакцию от чужой.
     Но в возвращаемую запись попадает только совпавший с читателем. */
  assert.match(loadPart, /if \(viewerId && reaction\.userId === viewerId\) entry\.mine\.push/)
  // Наружу уходят два поля: счётчики по видам и свои реакции.
  assert.match(loadPart, /counts: Record<string, number>; mine: string\[\]/)
})
