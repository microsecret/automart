#!/usr/bin/env node

import fs from "node:fs"
import http from "node:http"
import https from "node:https"
import path from "node:path"

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const envPath = path.join(projectRoot, ".env")
const envOverrideKeys = new Set(["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"])

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (!match || (process.env[match[1]] && !envOverrideKeys.has(match[1]))) continue
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "")
  }
}

const botToken = process.env.TELEGRAM_BOT_TOKEN
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
const localPort = Number(process.env.PORT || 4001)
const statePath = process.env.TELEGRAM_POLLING_STATE_PATH || "/var/lib/automart-telegram/offset"
const pollTimeoutSeconds = 30
const maxBackoffMs = 60_000

if (!botToken || !webhookSecret) {
  console.error("[telegram-polling] TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET are required")
  process.exit(1)
}

let running = true
let offset = readOffset()

function readOffset() {
  try {
    const value = Number(fs.readFileSync(statePath, "utf8").trim())
    return Number.isSafeInteger(value) && value >= 0 ? value : 0
  } catch {
    return 0
  }
}

function persistOffset(value) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true })
  const temporaryPath = `${statePath}.${process.pid}.tmp`
  fs.writeFileSync(temporaryPath, String(value), { mode: 0o600 })
  fs.renameSync(temporaryPath, statePath)
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function telegramApi(method, payload = {}, timeoutMs = 20_000) {
  const requestBody = JSON.stringify(payload)
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: "api.telegram.org",
      family: 4,
      port: 443,
      path: `/bot${botToken}/${method}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(requestBody),
      },
      timeout: timeoutMs,
    }, (response) => {
      let responseBody = ""
      response.setEncoding("utf8")
      response.on("data", (chunk) => {
        responseBody += chunk
        if (responseBody.length > 2_000_000) request.destroy(new Error("Telegram API response is too large"))
      })
      response.on("end", () => {
        const body = (() => {
          try { return JSON.parse(responseBody) } catch { return null }
        })()
        if ((response.statusCode || 500) >= 400 || !body?.ok) {
          reject(new Error(body?.description || `Telegram API ${response.statusCode || 500}`))
          return
        }
        resolve(body.result)
      })
    })
    request.on("error", reject)
    request.on("timeout", () => request.destroy(new Error(`Telegram API ${method} timed out`)))
    request.end(requestBody)
  })
}

function forwardToLocalWebhook(update) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(update)
    const request = http.request({
      hostname: "127.0.0.1",
      port: localPort,
      path: "/api/telegram/webhook",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "X-Telegram-Bot-Api-Secret-Token": webhookSecret,
      },
      timeout: 15_000,
    }, (response) => {
      let responseBody = ""
      response.on("data", (chunk) => { responseBody += chunk })
      response.on("end", () => {
        if (response.statusCode !== 200) {
          reject(new Error(`Local webhook ${response.statusCode}: ${responseBody.slice(0, 200)}`))
          return
        }
        resolve()
      })
    })
    request.on("error", reject)
    request.on("timeout", () => request.destroy(new Error("Local webhook timed out")))
    request.end(body)
  })
}

async function enablePollingMode() {
  let backoffMs = 2_000
  while (running) {
    try {
      await telegramApi("deleteWebhook", { drop_pending_updates: false })
      console.log("[telegram-polling] Polling mode enabled; pending updates preserved")
      return
    } catch (error) {
      console.error(`[telegram-polling] Cannot disable webhook: ${error instanceof Error ? error.message : error}`)
      await sleep(backoffMs)
      backoffMs = Math.min(backoffMs * 2, maxBackoffMs)
    }
  }
}

async function poll() {
  await enablePollingMode()
  let backoffMs = 2_000
  let connectivityFailed = false
  console.log(`[telegram-polling] Started on local port ${localPort}; offset=${offset}`)

  while (running) {
    try {
      const updates = await telegramApi("getUpdates", {
        offset,
        timeout: pollTimeoutSeconds,
        allowed_updates: ["message"],
      }, (pollTimeoutSeconds + 15) * 1_000)

      if (connectivityFailed) {
        console.log("[telegram-polling] Telegram connectivity restored")
        connectivityFailed = false
      }

      for (const update of updates) {
        await forwardToLocalWebhook(update)
        offset = update.update_id + 1
        persistOffset(offset)
      }
      if (updates.length > 0) console.log(`[telegram-polling] Processed ${updates.length} update(s); offset=${offset}`)
      backoffMs = 2_000
    } catch (error) {
      connectivityFailed = true
      console.error(`[telegram-polling] ${error instanceof Error ? error.message : error}`)
      await sleep(backoffMs)
      backoffMs = Math.min(backoffMs * 2, maxBackoffMs)
    }
  }
}

process.on("SIGINT", () => { running = false })
process.on("SIGTERM", () => { running = false })

poll().catch((error) => {
  console.error("[telegram-polling] Fatal error", error)
  process.exit(1)
})
