#!/usr/bin/env node

/**
 * Configures the production Telegram bot from server environment variables.
 * No token is stored in the repository or printed by this script.
 *
 * Required: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_MINI_APP_URL
 */

const token = process.env.TELEGRAM_BOT_TOKEN
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
const miniAppUrl = process.env.TELEGRAM_MINI_APP_URL

if (!token || !webhookSecret || !miniAppUrl) {
  throw new Error("TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and TELEGRAM_MINI_APP_URL must be configured")
}

const miniApp = new URL(miniAppUrl)
if (miniApp.protocol !== "https:") throw new Error("TELEGRAM_MINI_APP_URL must use HTTPS")
const webhookUrl = new URL("/api/telegram/webhook", miniApp).toString()

async function api(method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.ok) throw new Error(body?.description || `Telegram API ${response.status}`)
  return body.result
}

const bot = await api("getMe", {})
await api("setMyCommands", {
  commands: [
    { command: "start", description: "🚀 Регистрация и вход в LeWheel" },
    { command: "help", description: "💬 Продолжить регистрацию или открыть приложение" },
  ],
})
await api("setMyDescription", {
  description: "🚘 LeWheel — автомобильная площадка. Регистрация за 3 шага: телефон, почта и пароль. После неё Mini App входит автоматически по Telegram ID.",
})
await api("setMyShortDescription", {
  short_description: "🚘 Автомобили, аукционы и сделки в одном Mini App.",
})
await api("setChatMenuButton", {
  menu_button: { type: "web_app", text: "🚘 Открыть LeWheel", web_app: { url: miniApp.toString() } },
})
await api("setWebhook", {
  url: webhookUrl,
  secret_token: webhookSecret,
  allowed_updates: ["message"],
  drop_pending_updates: false,
})

console.log(JSON.stringify({ configured: true, botUsername: bot.username || null, webhookUrl }, null, 2))
