import test from "node:test"
import assert from "node:assert/strict"
import { conversationSearchGlob } from "../src/lib/conversation-search.mjs"

test("blank search stays on the unfiltered path", () => {
  for (const value of [undefined, null, "", "   "]) assert.equal(conversationSearchGlob(value), null)
})
test("Cyrillic including yo and ASCII use explicit case pairs", () => {
  assert.equal(conversationSearchGlob(" ЁжA "), "*[ёЁ][жЖ][aA]*")
  assert.equal(conversationSearchGlob("ёжa"), conversationSearchGlob("ЁЖA"))
})
test("wildcards and brackets remain literal", () => {
  assert.equal(conversationSearchGlob("*?[x]%"), "*[*][?][[][xX]]%*")
})
test("query normalization is canonical", () => {
  assert.equal(conversationSearchGlob("е\u0308"), conversationSearchGlob("ё"))
})
test("query length is bounded", () => {
  assert.ok(conversationSearchGlob("я".repeat(120)))
  assert.throws(() => conversationSearchGlob("я".repeat(121)), RangeError)
})
