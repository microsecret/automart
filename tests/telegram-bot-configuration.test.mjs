import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import vm from "node:vm"

const source = (await readFile(new URL("../scripts/configure-telegram-bot.mjs", import.meta.url), "utf8"))
  .replace(/^#![^\n]*\n/, "")

async function configure(env = {}) {
  const calls = [], output = []
  await vm.runInNewContext(`(async () => { ${source}\n})()`, {
    process: { env }, URL, AbortSignal,
    console: { log: (value) => output.push(value) },
    fetch: async (url, options) => {
      calls.push({ method: url.split("/").at(-1), payload: JSON.parse(options.body) })
      return { ok: true, json: async () => ({ ok: true, result: { username: "audit_dummy_bot" } }) }
    },
  })
  return { calls, output }
}

test("webhook configuration preserves membership moderation and callback delivery", async () => {
  const secret = "dummy-webhook-secret"
  const token = "123456:dummy-token"
  const { calls, output } = await configure({
    TELEGRAM_BOT_TOKEN: token,
    TELEGRAM_WEBHOOK_SECRET: secret,
    TELEGRAM_MINI_APP_URL: "https://example.invalid/telegram",
  })
  const webhook = calls.find((call) => call.method === "setWebhook")?.payload
  assert.ok(webhook)
  assert.deepEqual(webhook.allowed_updates, ["message", "callback_query", "chat_member"])
  assert.equal(webhook.drop_pending_updates, false)
  assert.equal(webhook.secret_token, secret)
  assert.equal(webhook.url, "https://example.invalid/api/telegram/webhook")
  assert.ok(output.every((line) => !line.includes(token) && !line.includes(secret)))
})

test("incomplete configuration fails before contacting the provider", async () => {
  await assert.rejects(configure({}), /must be configured/)
})
