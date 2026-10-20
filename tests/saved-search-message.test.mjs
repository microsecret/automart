import test from "node:test"
import assert from "node:assert/strict"
import { savedSearchTelegramText } from "../src/lib/saved-search-message.mjs"

test("search titles cannot inject Telegram HTML or links", () => {
  const text = savedSearchTelegramText('<a href="https://example.invalid">Honda & Kia</a>', 3, "новых варианта")
  assert.ok(text.includes('&lt;a href="https://example.invalid"&gt;Honda &amp; Kia&lt;/a&gt;'))
  assert.ok(!text.includes("<a "))
  assert.ok(text.includes("<b>3 новых варианта</b>"))
})

test("plain Unicode titles and caller-provided shared plural labels are retained", () => {
  assert.equal(savedSearchTelegramText("Тойота 日本", 1, "новый вариант"), "🔔 <b>1 новый вариант</b> по подписке «Тойота 日本»\n\nОткрыть выдачу с вашими фильтрами:")
})
