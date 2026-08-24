import assert from "node:assert/strict"
import test from "node:test"
import { auctionSourceTablePairs } from "../src/lib/auction-source-table.mjs"

test("extracts BE FORWARD cells separated by an HTML comment without merging headings", () => {
  const html = `
    <tr>
      <th class="gray">Model Code</th><td>DBA-E12</td>
      <th class="gray">Steering</th>
      <!-- source comment between the heading and value -->
      <td>Right</td>
    </tr>
    <tr>
      <th class="gray">Engine Size</th><td>1,200cc</td>
      <th class="gray">Ext. Color</th><td>White</td>
    </tr>`

  const pairs = auctionSourceTablePairs(html)
  assert.equal(pairs.get("Model Code"), "DBA-E12")
  assert.equal(pairs.get("Steering"), "Right")
  assert.equal(pairs.get("Engine Size"), "1,200cc")
  assert.equal(pairs.get("Ext. Color"), "White")
  assert.equal(pairs.has("Steering Right Engine Size"), false)
})

test("normalizes nested markup and common entities in source tables", () => {
  const pairs = auctionSourceTablePairs(`
    <tr><th><span>Current&nbsp;Location</span></th><td><strong>OSAKA</strong><br>Japan</td></tr>
  `)
  assert.equal(pairs.get("Current Location"), "OSAKA\nJapan")
})
