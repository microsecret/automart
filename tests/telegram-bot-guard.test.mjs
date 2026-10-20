import test from "node:test"
import assert from "node:assert/strict"
import { guardTelegramBots } from "../src/lib/telegram-bot-guard.mjs"

const bot = { id: 20, is_bot: true }
function fixture(options = {}) {
  const calls = [], approvals = new Map(), warnings = []
  const chat = { id: -100, type: "supergroup" }
  const deps = {
    ownBotId: "10", enabled: () => options.enabled !== false,
    api: async (method, payload) => {
      calls.push({ method, payload })
      if (method !== "getChatMember") return true
      if (options.lookupFailure) throw new Error("unavailable")
      if (String(payload.user_id) === "10") return { status: "administrator", can_restrict_members: options.restrict !== false, can_delete_messages: true }
      if (String(payload.user_id) === "30") return { status: options.admin ? "administrator" : "member" }
      return { status: options.targetStatus || "member" }
    },
    approved: async (chatId, botId) => approvals.has(`${chatId}:${botId}`),
    approve: async (chatId, botId, actor) => approvals.set(`${chatId}:${botId}`, actor),
    forget: async (chatId, botId) => approvals.delete(`${chatId}:${botId}`),
    warn: (...args) => warnings.push(args),
  }
  const join = { message: { message_id: 99, chat, from: { id: 30 }, new_chat_members: [bot] } }
  return { calls, approvals, warnings, deps, join, chat }
}
const bans = (f) => f.calls.filter((call) => call.method === "banChatMember")

test("ordinary member-added bot is banned with message revocation", async () => {
  const f = fixture(); await guardTelegramBots(f.join, f.deps)
  assert.deepEqual(bans(f), [{ method: "banChatMember", payload: { chat_id: "-100", user_id: "20", revoke_messages: true } }])
  assert.equal(f.calls.some((call) => call.method === "deleteMessage"), true)
  assert.equal(f.calls.some((call) => call.method === "unbanChatMember"), false)
})
test("administrator-added bot without administrator role is banned", async () => {
  const f = fixture({ admin: true }); await guardTelegramBots(f.join, f.deps)
  assert.equal(bans(f).length, 1); assert.equal(f.approvals.size, 0)
  assert.equal(f.calls.some((call) => String(call.payload.user_id) === "30"), false)
})
test("legacy approval in the same chat no longer grants an exception", async () => {
  const f = fixture(); f.approvals.set("-100:20", "30")
  await guardTelegramBots(f.join, f.deps); assert.equal(bans(f).length, 1)
})
test("anonymous administrator-added non-admin bot is also banned", async () => {
  const f = fixture(); f.join.message.sender_chat = { id: -100, type: "supergroup" }
  f.join.message.from = { id: 1087968824, is_bot: true }
  await guardTelegramBots(f.join, f.deps)
  assert.equal(bans(f).length, 1); assert.equal(f.approvals.size, 0)
})
test("anonymous group speech is not mistaken for a bot account", async () => {
  const f = fixture()
  assert.equal(await guardTelegramBots({ message: { chat: f.chat, from: { id: 1087968824, is_bot: true }, sender_chat: { id: -100 } } }, f.deps), false)
  assert.equal(f.calls.length, 0)
})
test("own moderator bot is never banned", async () => {
  const f = fixture(); f.join.message.new_chat_members = [{ id: 10, is_bot: true }]
  await guardTelegramBots(f.join, f.deps); assert.equal(f.calls.length, 0)
})
test("bot administrator is protected regardless of inviter", async () => {
  const f = fixture({ targetStatus: "administrator" }); await guardTelegramBots(f.join, f.deps)
  assert.equal(bans(f).length, 0)
})
test("missing restriction permission warns without claiming removal", async () => {
  const f = fixture({ restrict: false }); await guardTelegramBots(f.join, f.deps)
  assert.equal(bans(f).length, 0); assert.equal(f.warnings.length, 1)
})
test("out-of-scope chat and private chat perform no Telegram calls", async () => {
  const f = fixture({ enabled: false }); await guardTelegramBots(f.join, f.deps)
  assert.equal(f.calls.length, 0)
  const g = fixture(); g.join.message.chat.type = "private"; await guardTelegramBots(g.join, g.deps)
  assert.equal(g.calls.length, 0)
})
test("human member is never removed", async () => {
  const f = fixture(); f.join.message.new_chat_members = [{ id: 40, is_bot: false }]
  assert.equal(await guardTelegramBots(f.join, f.deps), false); assert.equal(f.calls.length, 0)
})
test("chat_member admission works without a service message", async () => {
  const f = fixture(); await guardTelegramBots({ chat_member: { chat: f.chat, from: { id: 30 }, old_chat_member: { status: "left", user: bot }, new_chat_member: { status: "member", user: bot } } }, f.deps)
  assert.equal(bans(f).length, 1)
})
test("present non-admin bot is removed on a membership permission update", async () => {
  const f = fixture(); await guardTelegramBots({ chat_member: { chat: f.chat, from: { id: 30 }, old_chat_member: { status: "member", user: bot }, new_chat_member: { status: "restricted", is_member: true, user: bot } } }, f.deps)
  assert.equal(bans(f).length, 1)
})
test("demotion from administrator to member removes the bot", async () => {
  const f = fixture(); await guardTelegramBots({ chat_member: { chat: f.chat, from: { id: 30 }, old_chat_member: { status: "administrator", user: bot }, new_chat_member: { status: "member", user: bot } } }, f.deps)
  assert.equal(bans(f).length, 1)
})
test("departure removes old approval before any future rejoin", async () => {
  const f = fixture(); f.approvals.set("-100:20", "30")
  await guardTelegramBots({ chat_member: { chat: f.chat, new_chat_member: { status: "left", user: bot } } }, f.deps)
  assert.equal(f.approvals.size, 0)
  await guardTelegramBots(f.join, f.deps); assert.equal(bans(f).length, 1)
})
test("unknown role never produces a speculative ban", async () => {
  const f = fixture({ lookupFailure: true }); await assert.rejects(guardTelegramBots(f.join, f.deps))
  assert.equal(bans(f).length, 0)
})
test("duplicate join after removal does not ban again", async () => {
  const f = fixture({ targetStatus: "kicked" }); await guardTelegramBots(f.join, f.deps)
  assert.equal(bans(f).length, 0)
})
test("an observable unapproved bot message is removed as fallback", async () => {
  const f = fixture(); await guardTelegramBots({ message: { chat: f.chat, from: bot, message_id: 123 } }, f.deps)
  assert.equal(bans(f).length, 1)
})
