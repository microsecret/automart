import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the explicit extension.
import { buildPartnerSlaMetrics, calculatePartnerRating, describePartnerRating, SLA_NEUTRAL_RATING } from "../src/lib/partner-sla.ts"
import { readServiceRegions, scoreAuctionPartner } from "../src/lib/partner-scoring.js"

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000)

test("gives a newcomer a neutral rating so they can win a first inquiry", () => {
  assert.equal(calculatePartnerRating({ responseMinutes: null, acceptedOffers: 0, missedOffers: 0, closedDeals: 0 }), SLA_NEUTRAL_RATING)
  assert.deepEqual(buildPartnerSlaMetrics([]).rating, SLA_NEUTRAL_RATING)
})

test("ranks a fast reliable partner above a slow one", () => {
  const fast = calculatePartnerRating({ responseMinutes: 12, acceptedOffers: 9, missedOffers: 1, closedDeals: 8 })
  const slow = calculatePartnerRating({ responseMinutes: 600, acceptedOffers: 4, missedOffers: 6, closedDeals: 1 })
  assert.ok(fast > slow, `быстрый ${fast} должен быть выше медленного ${slow}`)
  assert.ok(fast >= 80, `ожидали высокий рейтинг, получили ${fast}`)
})

test("counts an expired offer as missed but a decline as an answer", () => {
  const metrics = buildPartnerSlaMetrics([
    { status: "ACCEPTED", createdAt: minutesAgo(120), respondedAt: minutesAgo(100), expiresAt: minutesAgo(60) },
    { status: "DECLINED", createdAt: minutesAgo(120), respondedAt: minutesAgo(90), expiresAt: minutesAgo(60) },
    { status: "OFFERED", createdAt: minutesAgo(300), respondedAt: null, expiresAt: minutesAgo(30) },
  ])
  assert.equal(metrics.acceptedOffers, 1)
  assert.equal(metrics.missedOffers, 1, "явный отказ не считается пропуском")
})

test("ignores an offer another partner claimed first", () => {
  // Заявку забрал кто-то другой: партнёр не отвечал и не отказывался, поэтому
  // такой оффер не должен ни улучшать, ни ухудшать его показатели.
  const metrics = buildPartnerSlaMetrics([
    { status: "SUPERSEDED", createdAt: minutesAgo(300), respondedAt: minutesAgo(30), expiresAt: minutesAgo(10) },
  ])
  assert.equal(metrics.acceptedOffers, 0)
  assert.equal(metrics.missedOffers, 0)
  assert.equal(metrics.responseMinutes, null, "чужая скорость не приписывается партнёру")
  assert.equal(metrics.rating, SLA_NEUTRAL_RATING)
})

test("does not punish a partner for an offer that is still open", () => {
  const metrics = buildPartnerSlaMetrics([
    { status: "OFFERED", createdAt: minutesAgo(10), respondedAt: null, expiresAt: new Date(Date.now() + 60 * 60_000) },
  ])
  assert.equal(metrics.missedOffers, 0)
})

test("uses the median response time so one outlier does not define the partner", () => {
  const metrics = buildPartnerSlaMetrics([
    { status: "ACCEPTED", createdAt: minutesAgo(200), respondedAt: minutesAgo(190), expiresAt: minutesAgo(140) },
    { status: "ACCEPTED", createdAt: minutesAgo(180), respondedAt: minutesAgo(168), expiresAt: minutesAgo(120) },
    { status: "ACCEPTED", createdAt: minutesAgo(900), respondedAt: minutesAgo(300), expiresAt: minutesAgo(240) },
  ])
  assert.ok(metrics.responseMinutes !== null && metrics.responseMinutes <= 30, `медиана не должна тянуться за выбросом, получили ${metrics.responseMinutes}`)
})

test("keeps the rating inside the published range", () => {
  const best = calculatePartnerRating({ responseMinutes: 1, acceptedOffers: 100, missedOffers: 0, closedDeals: 100 })
  const worst = calculatePartnerRating({ responseMinutes: 100_000, acceptedOffers: 0, missedOffers: 50, closedDeals: 0 })
  assert.ok(best <= 100 && best >= 90, `лучший рейтинг вне диапазона: ${best}`)
  assert.ok(worst >= 0 && worst <= 20, `худший рейтинг вне диапазона: ${worst}`)
})

test("labels the partner level for the admin registry", () => {
  assert.equal(describePartnerRating(90, true).label, "Отвечает быстро")
  assert.equal(describePartnerRating(50, false).label, "Новый партнёр")
  assert.equal(describePartnerRating(10, true).color, "red")
})

test("routes an inquiry to a reliable partner in the buyer city", () => {
  assert.deepEqual(readServiceRegions('["Екатеринбург", "Китай"]'), ["екатеринбург", "китай"])
  const local = scoreAuctionPartner({
    destinationCity: "Екатеринбург", sourceCountry: "CN", serviceRegions: '["Екатеринбург", "Китай"]',
    activeAssignments: 1, openOffers: 1, slaRating: 80, slaResponseMinutes: 25,
  })
  const remote = scoreAuctionPartner({
    destinationCity: "Екатеринбург", sourceCountry: "CN", serviceRegions: '["Москва"]',
    activeAssignments: 0, openOffers: 0, slaRating: 95, slaResponseMinutes: 10,
  })
  assert.ok(local.score > remote.score, `местный партнёр ${local.score} должен быть выше удалённого ${remote.score}`)
  assert.match(local.reason, /городе доставки/)
})
