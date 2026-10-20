// Isolated API/DB regression checks. The runner disables the Telegram token.
import assert from "node:assert/strict"
import { writeFile } from "node:fs/promises"
import { PrismaClient } from "@prisma/client"

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.ok((process.env.DATABASE_URL || "").includes("audit"))
assert.ok(process.env.TELEGRAM_WEBHOOK_SECRET)
const db = new PrismaClient()
const results = []
const now = new Date()
const anchor = new Date(Math.floor(now.getTime() / 60000) * 60000)
const old = new Date(now.getTime() - 180000)
let serial = 0
function check(name, condition) { assert.ok(condition, name); results.push(name); console.log(`PASS ${name}`) }
async function user(name, extra = {}) { return db.user.create({ data: { name, email: `notify-${Date.now()}-${serial++}@audit.invalid`, ...extra } }) }
async function search(owner, make, since = old) { return db.savedSearch.create({ data: { userId: owner.id, title: `${make} <b> & поиск`, scope: "AUCTIONS", query: `country=JP&make=${make}`, createdAt: old, lastNotifiedAt: since } }) }
async function lot(make, extra = {}) {
  return db.auctionListing.create({ data: { source: "GOONET", sourceId: `notify-${Date.now()}-${serial++}`, sourceUrl: "https://example.invalid/audit", make, model: "Audit", year: now.getFullYear() - 1, country: "JP", sourcePrice: 1000000, sourceCurrency: "JPY", priceRub: 1000000, markup: 0, finalPrice: 1000000, sourceLastSeenAt: now, createdAt: new Date(now.getTime() - 1000), ...extra } })
}
async function run() {
  const response = await fetch(`${base}/api/saved-searches/notify`, { method: "POST", headers: { "x-telegram-bot-api-secret-token": process.env.TELEGRAM_WEBHOOK_SECRET } })
  const payload = await response.json()
  check("worker response is healthy", response.status === 200 && payload.failed === 0 && payload.telegramSent === 0)
  return payload
}
try {
  const quota = await user("Лимит")
  await lot("Quota")
  for (let i = 0; i < 6; i++) await search(quota, "Quota")
  const policy = await user("Политика")
  const policySearch = await search(policy, "Policy")
  await lot("Policy")
  await lot("Policy", { sourceLastSeenAt: new Date(now.getTime() - 80 * 3600000) })
  await lot("Policy", { adminHiddenAt: now })
  await lot("Policy", { year: 2000 })
  await lot("Policy", { auctionDate: new Date(now.getTime() - 1000) })
  await lot("Policy", { createdAt: new Date(now.getTime() + 86400000) })
  const timing = await user("Точные интервалы")
  const early = await search(timing, "Timing", new Date(anchor.getTime() - 50000))
  const late = await search(timing, "Timing", new Date(anchor.getTime() - 30000))
  await lot("Timing", { createdAt: new Date(anchor.getTime() - 40000) })
  const emptyOwner = await user("Пустой поиск")
  const empty = await search(emptyOwner, "NoMatches")
  const banned = await user("Ограниченный", { accountStatus: "BANNED" })
  await search(banned, "Quota")
  const blockedId = `audit-blocked-${Date.now()}`
  const blocked = await user("Бот заблокирован", { telegramId: blockedId })
  await db.telegramContact.create({ data: { telegramId: blockedId, blocked: true } })
  const blockedSearch = await search(blocked, "Quota")

  await run()
  check("site fallback works without Telegram for auction searches", await db.notification.count({ where: { userId: policy.id } }) === 1)
  check("public auction policy excludes hidden, stale, over-age, ended and future-created lots", (await db.savedSearch.findUniqueOrThrow({ where: { id: policySearch.id } })).lastMatchCount === 1)
  check("one minute does not collapse distinct matching windows", (await db.savedSearch.findUniqueOrThrow({ where: { id: early.id } })).lastMatchCount === 1 && (await db.savedSearch.findUniqueOrThrow({ where: { id: late.id } })).lastMatchCount === 0)
  const emptyAfter = await db.savedSearch.findUniqueOrThrow({ where: { id: empty.id } })
  check("empty searches advance queue and matching checkpoint", emptyAfter.lastCheckedAt > old && emptyAfter.lastNotifiedAt > old && emptyAfter.lastMatchCount === 0)
  check("banned accounts do not receive notifications", await db.notification.count({ where: { userId: banned.id } }) === 0)
  check("blocked Telegram contacts use site only", (await db.savedSearchDelivery.findFirstOrThrow({ where: { searchId: blockedSearch.id } })).telegramStatus === "NOT_REQUESTED")
  check("daily quota allows only five of six searches", await db.savedSearchDelivery.count({ where: { userId: quota.id } }) === 5)
  const pending = await db.savedSearch.findFirstOrThrow({ where: { userId: quota.id, lastNotifiedAt: old } })
  check("quota deferral rotates queue without losing match watermark", pending.lastCheckedAt > old)
  await run()
  check("next worker invocation reuses durable daily quota", await db.savedSearchDelivery.count({ where: { userId: quota.id } }) === 5)
  check("same interval is not notified twice", await db.notification.count({ where: { userId: policy.id } }) === 1)
  await db.notification.deleteMany({ where: { userId: quota.id } })
  await run()
  check("deleting visible notifications does not reset quota", await db.savedSearchDelivery.count({ where: { userId: quota.id } }) === 5 && await db.notification.count({ where: { userId: quota.id } }) === 0)
  await db.savedSearchDelivery.updateMany({ where: { userId: quota.id }, data: { createdAt: new Date(now.getTime() - 25 * 3600000) } })
  await run()
  check("deferred search is delivered when the rolling window opens", await db.savedSearchDelivery.count({ where: { userId: quota.id } }) === 6 && await db.notification.count({ where: { userId: quota.id } }) === 1)
  // Each protected HTTP invocation above re-reads the durable ledger.
  await writeFile(process.env.NOTIFY_AUDIT_REPORT || "/tmp/lewheel-saved-search-notifications-20261020.json", JSON.stringify({ mode: "isolated database; live Telegram token disabled", results, failures: [] }, null, 2))
  console.log(`SAVED_SEARCH_NOTIFICATIONS_VERIFIED checks=${results.length}`)
} finally { await db.$disconnect() }
