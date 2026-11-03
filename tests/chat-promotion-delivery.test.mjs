// Server only. Real paid-delivery worker and post builder, fake DB/Telegram.
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import ts from "typescript"

const encode = (value) => `data:text/javascript;base64,${Buffer.from(value).toString("base64")}`
const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const builder = encode(compile("../src/lib/chat-promotion-post.ts"))
const part = (id, photos = []) => ({ id, images: JSON.stringify(photos), location: "Казань", condition: "NEW", oemNumber: "OEM-123", brandName: "Brand", make: "Toyota", model: "Camry", yearFrom: 2014, yearTo: 2017, availability: "IN_STOCK" })
const listing = (subject) => ({ id: "listing-" + subject.id, title: "Фара", price: 7000, status: "ACTIVE", deletedAt: null, vehicle: null, part: subject, user: { telegramId: "seller-telegram" } })
const order = (id, data) => ({ id, listingId: data.id, listing: data })

async function fixture(orders, recent = [], cleanup = {}) {
  const calls = []
  const posts = []
  const notices = [...(cleanup.notified || [])]
  const key = `paidParts${Math.random()}`
  globalThis[key] = {
    prisma: {
      promotionOrder: { findMany: async (query) => {
        assert.equal(query.where.tariffId, "chats")
        if (query.select.listing.select.part) return orders
        assert.equal(query.where.listing.status, "ACTIVE")
        assert.equal(query.where.listing.deletedAt, null)
        if (query.select.promoUntil) {
          assert.equal(query.where.promoUntil.lte, undefined, "expiry audit includes later paid renewals")
          return cleanup.expiryOrders || []
        }
        return cleanup.ongoing || []
      } },
      telegramChat: { findMany: async () => [{ id: "chat-1" }] },
      chatPromotionPost: {
        findMany: async (query) => {
          if (query.where.order?.promoUntil) {
            const retained = query.where.order.listingId?.notIn || []
            return (cleanup.expired || []).filter((row) => !retained.includes(row.listingId))
          }
          if (!query.where.order) return []
          assert.equal(query.where.orderId, undefined, "recent publications include expired older orders")
          assert.equal(query.where.order.promoUntil, undefined)
          return recent.filter((row) => query.where.order.listingId.in.includes(row.order.listingId))
        },
        create: async ({ data }) => { posts.push(data); return data },
        update: async () => {},
      },
      notification: {
        findMany: async (query) => notices.filter((row) => query.where.relatedId.in.includes(row.relatedId)),
        create: async ({ data }) => { notices.push(data); return data },
      },
    },
    telegramApi: async (method, payload) => { calls.push({ method, payload }); return { message_id: 100 } },
    telegramPhotoApi: async (payload, options) => { calls.push({ method: options?.method || "sendPhoto", payload, options }); return { message_id: 100 } },
    getTelegramBotUsername: () => "lewheelbot",
    readLocalPhotos: async () => new Map(),
    photoMime: () => "image/jpeg",
    absoluteUrl: (url) => new URL(url, "https://lewheel.ru/").toString(),
    schedule: (callback) => { callback(); return 0 },
  }
  const shim = encode(`export const {prisma,telegramApi,telegramPhotoApi,getTelegramBotUsername,readLocalPhotos,photoMime,absoluteUrl}=globalThis[${JSON.stringify(key)}]`)
  const source = compile("../src/lib/chat-promotion-delivery.ts").replace(/from "(@\/lib\/[^"]+)"/g, (_match, name) => `from ${JSON.stringify(name.endsWith("chat-promotion-post") ? builder : shim)}`)
  const { runChatPromotionDelivery, cleanupExpiredChatPromotions, notifyExpiringChatPromotions, REPOST_INTERVAL_MS } = await import(encode(`const setTimeout=globalThis[${JSON.stringify(key)}].schedule;\n${source}`))
  return { runChatPromotionDelivery, cleanupExpiredChatPromotions, notifyExpiringChatPromotions, REPOST_INTERVAL_MS, calls, posts, notices, dispose: () => { delete globalThis[key] } }
}

test("paid parts are delivered with original album, correct detail URL and pin", async () => {
  const photos = Array.from({ length: 12 }, (_, i) => `https://images.example/${i}.jpg`)
  const f = await fixture([order("paid-part", listing(part("part-123", photos)))])
  try {
    assert.equal(f.REPOST_INTERVAL_MS, 48 * 60 * 60 * 1000)
    assert.deepEqual(await f.runChatPromotionDelivery(), { processed: 1, published: 1, pinned: 1, skipped: 0 })
    const album = f.calls.find((call) => call.method === "sendMediaGroup")
    assert.equal(album.payload.media.length, 9)
    assert.equal(album.payload.media[0].media, photos[0])
    assert.equal(album.payload.media[8].media, photos[8])
    assert.match(album.payload.media[0].caption, /Артикул: OEM-123/)
    assert.equal(album.payload.media[1].caption, undefined)
    const controls = f.calls.find((call) => call.method === "sendMessage")
    assert.ok(controls.payload.reply_markup.inline_keyboard.flat().some((button) => button.url.endsWith("/listings/part/part-123")))
    assert.ok(f.calls.some((call) => call.method === "pinChatMessage"))
    assert.equal(f.posts[0].orderId, "paid-part")
  } finally { f.dispose() }
})

test("unsupported legacy subjects before the batch cannot starve a valid paid part", async () => {
  const invalid = Array.from({ length: 6 }, (_, i) => order(`invalid-${i}`, { ...listing(part(`invalid-${i}`)), part: null }))
  const f = await fixture([...invalid, order("paid-part", listing(part("part-123")))])
  try {
    assert.equal((await f.runChatPromotionDelivery({ maxOrders: 1 })).published, 1)
    assert.equal(f.posts[0].orderId, "paid-part")
    const text = f.calls.find((call) => call.method === "sendMessage").payload.text
    assert.match(text, /Фара/)
    assert.match(text, /7.000.₽/)
    assert.match(text, /Казань/)
  } finally { f.dispose() }
})

test("recent paid part publication retains the existing per-chat cooldown", async () => {
  const f = await fixture([order("paid-part", listing(part("part-123")))], [{ orderId: "paid-part", chatId: "chat-1", order: { listingId: "listing-part-123" } }])
  try { assert.equal((await f.runChatPromotionDelivery()).published, 0); assert.equal(f.calls.length, 0) } finally { f.dispose() }
})

test("two active orders for one listing produce one post and do not starve the next listing", async () => {
  const subject = listing(part("part-123"))
  const f = await fixture([
    order("oldest-paid", subject), order("renewal-paid", subject),
    order("next-listing", listing(part("part-456"))),
  ])
  try {
    const result = await f.runChatPromotionDelivery({ maxOrders: 2 })
    assert.equal(result.processed, 2)
    assert.equal(result.published, 2)
    assert.deepEqual(f.posts.map((post) => post.orderId), ["oldest-paid", "next-listing"])
  } finally { f.dispose() }
})

test("recent post on an expired predecessor still blocks a fresh renewal for 48 hours", async () => {
  const f = await fixture([order("new-renewal", listing(part("part-123")))], [
    { orderId: "expired-predecessor", chatId: "chat-1", order: { listingId: "listing-part-123" } },
  ])
  try { assert.equal((await f.runChatPromotionDelivery()).published, 0); assert.equal(f.calls.length, 0) } finally { f.dispose() }
})

test("cleanup retains an expired-order post while a valid same-owner chat renewal exists", async () => {
  const f = await fixture([], [], {
    ongoing: [{ listingId: "listing-part-123", userId: "owner", listing: { userId: "owner" } }],
    expired: [{ id: "old-post", listingId: "listing-part-123", chatId: "chat-1", messageId: 100, pinned: true }],
  })
  try { assert.deepEqual(await f.cleanupExpiredChatPromotions(), { removed: 0 }); assert.equal(f.calls.length, 0) } finally { f.dispose() }
})

test("cleanup still unpins and deletes when no active paid renewal remains", async () => {
  const f = await fixture([], [], {
    expired: [{ id: "old-post", listingId: "listing-part-123", chatId: "chat-1", messageId: 100, pinned: true }],
  })
  try {
    assert.deepEqual(await f.cleanupExpiredChatPromotions(), { removed: 1 })
    assert.deepEqual(f.calls.map((call) => call.method), ["unpinChatMessage", "deleteMessage"])
  } finally { f.dispose() }
})

test("an order owned by someone other than the listing owner cannot retain an expired post", async () => {
  const f = await fixture([], [], {
    ongoing: [{ listingId: "listing-part-123", userId: "old-owner", listing: { userId: "current-owner" } }],
    expired: [{ id: "old-post", listingId: "listing-part-123", chatId: "chat-1", messageId: 100, pinned: true }],
  })
  try { assert.equal((await f.cleanupExpiredChatPromotions()).removed, 1) } finally { f.dispose() }
})

test("expiry notice ignores an old near-end order when a paid renewal extends the listing", async () => {
  const days = (count) => new Date(Date.now() + count * 86400000)
  const subject = { listingId: "listing-part-123", userId: "owner", listing: { title: "Фара", userId: "owner" } }
  const f = await fixture([], [], { expiryOrders: [
    { ...subject, id: "old-near", promoUntil: days(1) },
    { ...subject, id: "renewal-far", promoUntil: days(12) },
  ] })
  try { assert.deepEqual(await f.notifyExpiringChatPromotions(), { notified: 0 }); assert.equal(f.notices.length, 0); assert.equal(f.calls.length, 0) } finally { f.dispose() }
})

test("equal latest expiry dates produce one stable warning and no repeat", async () => {
  const expiry = new Date(Date.now() + 2 * 86400000)
  const subject = { listingId: "listing-part-123", userId: "owner", listing: { title: "Фара", userId: "owner" }, promoUntil: expiry }
  const f = await fixture([], [], { expiryOrders: [
    { ...subject, id: "order-b" }, { ...subject, id: "order-a" },
  ] })
  try {
    assert.deepEqual(await f.notifyExpiringChatPromotions(), { notified: 1 })
    assert.equal(f.notices[0].relatedId, "order-a")
    assert.deepEqual(await f.notifyExpiringChatPromotions(), { notified: 0 })
    assert.equal(f.notices.length, 1)
    assert.equal(f.calls.length, 0)
  } finally { f.dispose() }
})
