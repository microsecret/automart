import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Native Node test discovery requires the explicit .ts extension.
import { composeCampaignAttribution } from "../src/lib/analytics-identity.ts"

test("кампания и конкретная кнопка сохраняются одной совместимой меткой", () => {
  assert.equal(composeCampaignAttribution("service_promo", "auctions"), "service_promo · auctions")
})

test("start_param Mini App остаётся видимым даже без utm_campaign", () => {
  assert.equal(composeCampaignAttribution("", "create"), "без кампании · create")
})

test("управляющие символы и чрезмерная длина не попадают в аналитику", () => {
  const result = composeCampaignAttribution("promo\n  summer", "x".repeat(200))
  assert.ok(result?.startsWith("promo summer · "))
  assert.ok((result?.length || 0) <= 120)
})

test("пустая атрибуция не создаёт фиктивную кампанию", () => {
  assert.equal(composeCampaignAttribution(null, undefined), null)
})
