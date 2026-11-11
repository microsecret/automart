// Server-only: real worker/builder, fake storage and Telegram; no providers.
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import ts from "typescript"
const encode = value => `data:text/javascript;base64,${Buffer.from(value).toString("base64")}`
const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const builderUrl = encode(compile("../src/lib/telegram-community-post.ts"))
const { communityChatUrl, communityIntervalMs, buildCommunityPost } = await import(builderUrl)

test("only the destination's public username or Telegram invite URL is shared", () => {
  assert.equal(communityChatUrl({ username: "my_car_chat", invite_link: "https://evil.example" }), "https://t.me/my_car_chat")
  assert.equal(communityChatUrl({ invite_link: "https://t.me/+aBc_123-" }), "https://t.me/+aBc_123-")
  for (const link of ["https://evil.example/chat", "https://t.me.evil.example/+abc", "javascript:alert(1)", "https://t.me/+abc?other=chat"]) {
    assert.equal(communityChatUrl({ invite_link: link }), null)
  }
  assert.equal(communityChatUrl({}), null)
})

test("6h minimum survives invalid overrides; post keeps current chat identity and HTML budget", () => {
  for (const value of [undefined, "", "0", "NaN", "Infinity", "1000"]) assert.equal(communityIntervalMs(value), 21600000)
  assert.equal(communityIntervalMs("43200000"), 43200000)
  const post = buildCommunityPost({ title: "<&🚗".repeat(1000), chatUrl: "https://t.me/current_chat", siteUrl: "https://lewheel.ru", botUsername: "lewheelbot" })
  assert.ok(post.text.length <= 1024)
  assert.equal((post.text.match(/<b>/g) || []).length, (post.text.match(/<\/b>/g) || []).length)
  assert.equal(new URL(post.keyboard.inline_keyboard[0][0].url).searchParams.get("url"), "https://t.me/current_chat")
  assert.ok(post.keyboard.inline_keyboard.flat().some(button => button.text.includes("Пройти авторизацию")))
})

async function fixture({ ownLink = true, error = false, paid = false } = {}) {
  const calls = [], rows = [{ id: "-1001", title: "Авторынок Уфа", active: true, marketingEnabled: true, lastPromoAt: null }]
  const key = `community${Math.random()}`
  const prisma = { telegramChat: {
    findMany: async query => rows.filter(row => row.active && row.marketingEnabled && (!row.lastPromoAt || row.lastPromoAt <= query.where.OR[1].lastPromoAt.lte)).map(row => ({ ...row })),
    count: async () => rows.length,
    updateMany: async query => {
      const row = rows.find(row => row.id === query.where.id && row.lastPromoAt === query.where.lastPromoAt)
      if (!row) return { count: 0 }
      Object.assign(row, query.data); return { count: 1 }
    },
    findUnique: async () => ({ active: true, marketingEnabled: true }),
    update: async query => { Object.assign(rows[0], query.data); return rows[0] },
  } }
  globalThis[key] = {
    prisma, absoluteUrl: () => "https://lewheel.ru", getTelegramBotUsername: () => "lewheelbot",
    isTelegramChatAdministrator: async () => true,
    telegramApi: async (method, payload) => {
      calls.push({ method, payload })
      if (method === "getChat") return { id: "-1001", ...(ownLink ? { username: "ufa_car_chat" } : {}) }
      if (error) throw new Error("fake uncertain delivery")
      assert.equal(method, "sendMessage", "no invite export, cleanup or unrelated provider call")
      return { message_id: 10 }
    },
    telegramPhotoApi: async (payload) => { calls.push({ method: "sendPhoto", payload }); return { message_id: 11 } },
    readLocalPhotos: async () => new Map(), photoMime: () => "image/jpeg",
    yookassaConfig: () => paid ? {} : null,
    readFile: async () => Buffer.from("test photo"),
    buildPromotionOfferPost: () => ({ caption: "Paid promotion", buttons: [] }),
    CHAT_PROMOTION_OPTIONS: [],
    PROMOTION_PAYMENT_SUPPORT: "test_admin",
  }
  const source = compile("../src/lib/telegram-marketing.ts").replace(/^import .*from "([^"]+)";$/gm, (line, target) => {
    if (target === "@/lib/telegram-community-post") return line.replace(target, builderUrl)
    if (target === "node:path") return line
    const names = line.match(/\{([^}]+)\}/)[1]
    return `const {${names}} = globalThis[${JSON.stringify(key)}];`
  })
  const module = await import(encode(source))
  return { ...module, calls, rows, close: () => { delete globalThis[key] } }
}

test("durable CAS admits one concurrent wave and prevents a repeat within6h", async () => {
  const f = await fixture()
  try {
    await Promise.all([f.processTelegramMarketingCampaign(), f.processTelegramMarketingCampaign()])
    assert.equal(f.calls.filter(call => call.method === "sendMessage").length, 1)
    assert.equal((await f.processTelegramMarketingCampaign()).due, 0)
    assert.equal(f.rows[0].lastPromoMessage, 10)
  } finally { f.close() }
})

test("configured checkout gets one illustrated offer in the week's first due slot", async () => {
  const f = await fixture({ paid: true })
  try {
    assert.equal((await f.processTelegramMarketingCampaign()).delivered, 1)
    assert.equal((await f.processTelegramMarketingCampaign()).due, 0)
    assert.equal(f.calls.filter(({ method }) => method === "sendPhoto").length, 1)
    assert.equal(f.rows[0].lastPromoMessage, 11)
  } finally { f.close() }
})

test("ambiguous delivery retains the6h claim; a missing own link skips safely", async () => {
  for (const options of [{ error: true }, { ownLink: false }]) {
    const f = await fixture(options)
    try {
      const result = await f.processTelegramMarketingCampaign()
      assert.equal(result.delivered, 0)
      assert.ok(f.rows[0].lastPromoAt)
      assert.equal((await f.processTelegramMarketingCampaign()).due, 0)
      assert.equal(f.calls.filter(call => call.method === "sendMessage").length, options.error ? 1 : 0)
    } finally { f.close() }
  }
})
