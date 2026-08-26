import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { applyLinePrefix, applyMarkup, isSafeLinkUrl, renderForumMarkup, stripForumMarkup } from "../src/lib/forum-markup.ts"

// === Безопасность ===

test("теги из сообщения не доходят до разметки", () => {
  // Главная проверка файла: сообщение форума пишет посторонний человек,
  // и <script> в нём означал бы кражу сессий у всех читателей темы.
  const html = renderForumMarkup('<script>alert("украл")</script>')
  assert.doesNotMatch(html, /<script/)
  assert.match(html, /&lt;script&gt;/)
})

test("картинка с обработчиком ошибки обезврежена", () => {
  // Классический обход: тега script нет, а код выполняется. Проверяем
  // отсутствие рабочего тега — сам текст «onerror=» внутри экранированной
  // строки безвреден и виден человеку как написанное.
  const html = renderForumMarkup('<img src=x onerror="alert(1)">')
  assert.doesNotMatch(html, /<img/)
  assert.match(html, /&lt;img/)
  assert.doesNotMatch(html, /"alert\(1\)"/)
})

test("ссылка с javascript отбрасывается", () => {
  // Ссылка не создаётся вовсе: текст остаётся написанным как есть, и
  // нажать на него нельзя.
  const html = renderForumMarkup("[нажми](javascript:alert(1))")
  assert.doesNotMatch(html, /<a /)
  assert.doesNotMatch(html, /href=/)
})

test("ссылка на данные отбрасывается", () => {
  const html = renderForumMarkup("[смотри](data:text/html,<script>alert(1)</script>)")
  assert.doesNotMatch(html, /<a /)
})

test("перевод строки внутри адреса не обходит проверку", () => {
  // «java\nscript:» — известный приём обхода наивных проверок.
  assert.equal(isSafeLinkUrl("java\nscript:alert(1)"), false)
  assert.equal(isSafeLinkUrl("https://drom.ru"), true)
  assert.equal(isSafeLinkUrl("mailto:ivan@example.com"), true)
})

test("кавычки в тексте не разрывают атрибут", () => {
  const html = renderForumMarkup('Он сказал "привет"')
  assert.doesNotMatch(html, /="привет"/)
  assert.match(html, /&quot;/)
})

test("внешняя ссылка помечена nofollow", () => {
  // Без этого форум за месяц становится площадкой для ссылочного спама.
  const html = renderForumMarkup("[Дром](https://drom.ru)")
  assert.match(html, /rel="nofollow noopener noreferrer"/)
  assert.match(html, /href="https:\/\/drom\.ru"/)
})

// === Разметка ===

test("жирный и курсив", () => {
  assert.match(renderForumMarkup("**важно**"), /<strong>важно<\/strong>/)
  assert.match(renderForumMarkup("*замечание*"), /<em>замечание<\/em>/)
})

test("жирный не путается с курсивом", () => {
  // Одна регулярка на оба случая давала <em>*текст*</em>.
  const html = renderForumMarkup("**точно**")
  assert.match(html, /<strong>точно<\/strong>/)
  assert.doesNotMatch(html, /<em>/)
})

test("зачёркнутый и код", () => {
  assert.match(renderForumMarkup("~~было~~"), /<del>было<\/del>/)
  assert.match(renderForumMarkup("`P0171`"), /<code>P0171<\/code>/)
})

test("звёздочки внутри кода остаются звёздочками", () => {
  // Человек показывает синтаксис, а не форматирует текст.
  const html = renderForumMarkup("`**вот так**`")
  assert.match(html, /<code>\*\*вот так\*\*<\/code>/)
  assert.doesNotMatch(html, /<strong>/)
})

test("маркированный список", () => {
  const html = renderForumMarkup("- масло\n- фильтр\n- свечи")
  assert.match(html, /<ul><li>масло<\/li><li>фильтр<\/li><li>свечи<\/li><\/ul>/)
})

test("нумерованный список", () => {
  const html = renderForumMarkup("1. снять колесо\n2. открутить суппорт")
  assert.match(html, /<ol><li>снять колесо<\/li><li>открутить суппорт<\/li><\/ol>/)
})

test("списки разных видов не сливаются", () => {
  const html = renderForumMarkup("- первый\n1. второй")
  assert.match(html, /<ul>/)
  assert.match(html, /<ol>/)
})

test("цитата", () => {
  const html = renderForumMarkup("> так писал автор темы")
  assert.match(html, /<blockquote>так писал автор темы<\/blockquote>/)
})

test("абзацы разделяются пустой строкой", () => {
  const html = renderForumMarkup("Первый абзац.\n\nВторой абзац.")
  assert.equal((html.match(/<p>/g) || []).length, 2)
})

test("перенос внутри абзаца сохраняется", () => {
  const html = renderForumMarkup("строка один\nстрока два")
  assert.match(html, /<br \/>/)
  assert.equal((html.match(/<p>/g) || []).length, 1)
})

test("пустое сообщение не даёт пустых тегов", () => {
  assert.equal(renderForumMarkup(""), "")
  assert.equal(renderForumMarkup("\n\n\n"), "")
})

// === Пересказ без разметки ===

test("пересказ убирает пометки", () => {
  const text = stripForumMarkup("**Важно**: смотрите `код` и [ссылку](https://drom.ru)")
  assert.equal(text, "Важно: смотрите код и ссылку")
})

test("пересказ убирает списки и цитаты", () => {
  assert.equal(stripForumMarkup("> цитата\n- пункт"), "цитата пункт")
})

// === Панель ===

test("кнопка оборачивает выделенное", () => {
  const result = applyMarkup("это важно очень", 4, 9, "**")
  assert.equal(result.value, "это **важно** очень")
  assert.equal(result.selectionStart, 6)
  assert.equal(result.selectionEnd, 11)
})

test("повторное нажатие снимает пометку", () => {
  // Иначе получаются ****двойные звёздочки****.
  const result = applyMarkup("это **важно** очень", 6, 11, "**")
  assert.equal(result.value, "это важно очень")
})

test("без выделения курсор встаёт внутрь пометки", () => {
  const result = applyMarkup("текст ", 6, 6, "**")
  assert.equal(result.value, "текст ****")
  assert.equal(result.selectionStart, 8)
  assert.equal(result.selectionEnd, 8)
})

test("пометка строк ставится в начало каждой", () => {
  const result = applyLinePrefix("масло\nфильтр", 0, 12, "- ")
  assert.equal(result.value, "- масло\n- фильтр")
})

test("повторное нажатие снимает пометку строк", () => {
  const result = applyLinePrefix("- масло\n- фильтр", 0, 16, "- ")
  assert.equal(result.value, "масло\nфильтр")
})
