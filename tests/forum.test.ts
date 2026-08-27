import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { forumSectionForMake, pluralReplies, pluralTopics, topicSlug, validatePostContent, validateTopicTitle } from "../src/lib/forum.ts"

test("адрес темы транслитерируется", () => {
  // Кириллица в адресе превращается в проценты: такую ссылку нельзя ни
  // прочитать, ни отправить другу.
  const slug = topicSlug("Как выбрать Haval Jolion", "abc123def")
  assert.match(slug, /^kak-vybrat-haval-jolion-/)
  assert.doesNotMatch(slug, /[а-яё]/i)
})

test("адрес заканчивается уникальным хвостом", () => {
  // Два человека вполне назовут темы одинаково.
  const a = topicSlug("Выбор масла", "aaa111")
  const b = topicSlug("Выбор масла", "bbb222")
  assert.notEqual(a, b)
})

test("заголовок из одних знаков даёт запасной адрес", () => {
  const slug = topicSlug("???!!!", "xyz789")
  assert.match(slug, /^tema-/)
})

test("адрес не заканчивается дефисом", () => {
  // Обрезка длинного заголовка могла оставить дефис перед хвостом.
  const slug = topicSlug("а".repeat(200), "abc123")
  assert.doesNotMatch(slug, /--/)
})

test("короткий заголовок отклоняется", () => {
  assert.ok(validateTopicTitle("Помощь"))
  assert.equal(validateTopicTitle("Как выбрать первую машину"), null)
})

test("заголовок капсом отклоняется", () => {
  // Капс в списке тем читается как крик.
  assert.ok(validateTopicTitle("СРОЧНО ПОМОГИТЕ С ВЫБОРОМ"))
})

test("короткая аббревиатура капсом не мешает", () => {
  // «ОСАГО или КАСКО» — законный заголовок.
  assert.equal(validateTopicTitle("ОСАГО или КАСКО — что выбрать"), null)
})

test("слишком длинный заголовок отклоняется", () => {
  assert.ok(validateTopicTitle("а".repeat(200)))
})

test("пустое сообщение отклоняется", () => {
  assert.ok(validatePostContent("   "))
  assert.equal(validatePostContent("Согласен"), null)
})

test("склонение ответов", () => {
  assert.equal(pluralReplies(1), "ответ")
  assert.equal(pluralReplies(3), "ответа")
  assert.equal(pluralReplies(11), "ответов")
  assert.equal(pluralReplies(21), "ответ")
  assert.equal(pluralReplies(0), "ответов")
})

test("склонение тем", () => {
  assert.equal(pluralTopics(1), "тема")
  assert.equal(pluralTopics(2), "темы")
  assert.equal(pluralTopics(5), "тем")
  assert.equal(pluralTopics(112), "тем")
})

test("раздел форума по марке", () => {
  // Ссылка с карточки машины в обсуждение её марки: без неё человек не
  // узнаёт, что о его машине уже спрашивали.
  assert.equal(forumSectionForMake("Haval"), "haval")
  assert.equal(forumSectionForMake("TOYOTA"), "toyota")
  assert.equal(forumSectionForMake("mercedes-benz"), "mercedes")
})

test("марка с пробелом распознаётся", () => {
  assert.equal(forumSectionForMake("Mercedes Benz"), "mercedes")
})

test("марка без своего раздела ссылки не даёт", () => {
  // Отправлять с вопросом про конкретную машину в «Европейские прочие»
  // значит обманывать ожидание.
  assert.equal(forumSectionForMake("Bentley"), null)
  assert.equal(forumSectionForMake(""), null)
  assert.equal(forumSectionForMake(null), null)
})
