#!/usr/bin/env node

/**
 * Uploads the approved local avatar to Telegram using only the server token.
 * The token is never stored in the repository or written to stdout.
 *
 * Telegram requires a static bot profile photo in JPEG format.
 * Usage: node scripts/set-telegram-bot-avatar.mjs [path-to-jpg]
 */

import { readFile } from "node:fs/promises"

const token = process.env.TELEGRAM_BOT_TOKEN
const avatarPath = process.argv[2] || "public/images/telegram-bot-avatar-v1.jpg"
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured")

const image = await readFile(avatarPath)
const form = new FormData()
form.set("photo", JSON.stringify({ type: "static", photo: "attach://profile_photo" }))
form.set("profile_photo", new Blob([image], { type: "image/jpeg" }), "telegram-bot-avatar.jpg")

const response = await fetch(`https://api.telegram.org/bot${token}/setMyProfilePhoto`, { method: "POST", body: form })
const body = await response.json().catch(() => null)
if (!response.ok || !body?.ok) throw new Error(body?.description || `Telegram API ${response.status}`)

console.log(JSON.stringify({ avatarUpdated: true, asset: avatarPath }, null, 2))
