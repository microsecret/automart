import crypto from "crypto"
import { readFile } from "node:fs/promises"
import https from "node:https"
import path from "node:path"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export type TelegramIdentity = {
  id: string
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
}

type TelegramBotProfile = { id: number | string; username?: string }
type TelegramChatMember = { status?: string; can_delete_messages?: boolean }
type TelegramApiResponse<T> = { ok?: boolean; description?: string; result?: T }

const CHAT_MODERATION_CACHE_TTL_MS = 5 * 60 * 1000
const moderatedChatCapability = new Map<string, { allowed: boolean; expiresAt: number }>()
const adminChatCapability = new Map<string, { allowed: boolean; expiresAt: number }>()
let botProfilePromise: Promise<TelegramBotProfile> | null = null

export class TelegramIdentityConflictError extends Error {}

export class TelegramRegistrationError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "INVALID_EMAIL" | "EMAIL_TAKEN" | "INVALID_PASSWORD" | "WRONG_STEP",
    message: string,
  ) {
    super(message)
  }
}

export type TelegramRegistrationStep = "contact" | "email" | "password" | "complete"

type TelegramRegistrationUser = {
  email?: string | null
  emailVerified?: Date | null
  phone?: string | null
  telegramVerifiedAt?: Date | null
  hashedPassword?: string | null
}

function timingSafeEqualHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex")
  const rightBuffer = Buffer.from(right, "hex")
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export function normalizePhone(value: unknown) {
  const raw = String(value || "").trim()
  if (!raw) return null
  const digits = raw.replace(/[^\d]/g, "")
  if (raw.startsWith("+")) return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`
  if (digits.length === 11 && digits.startsWith("7")) return `+${digits}`
  if (digits.length === 10) return `+7${digits}`
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`
  return null
}

export function isInternalTelegramEmail(value: unknown) {
  return typeof value === "string" && /^tg_\d+@telegram\.local$/i.test(value)
}

function isPasswordHash(value: unknown) {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value)
}

export function getTelegramRegistrationStep(user: TelegramRegistrationUser | null): TelegramRegistrationStep {
  if (!user?.telegramVerifiedAt || !user.phone) return "contact"
  if (!user.email || isInternalTelegramEmail(user.email)) return "email"
  if (!user.emailVerified || !isPasswordHash(user.hashedPassword)) return "password"
  return "complete"
}

export function isTelegramUserRegistered(user: TelegramRegistrationUser | null) {
  return getTelegramRegistrationStep(user) === "complete"
}

export function verifyTelegramInitData(initData: string, botToken: string, maxAgeSeconds = 24 * 60 * 60): TelegramIdentity | null {
  try {
    const params = new URLSearchParams(initData)
    const receivedHash = params.get("hash")
    const authDate = Number(params.get("auth_date"))
    if (!receivedHash || !Number.isInteger(authDate)) return null

    const now = Math.floor(Date.now() / 1000)
    if (authDate > now + 60 || now - authDate > maxAgeSeconds) return null

    params.delete("hash")
    const dataCheckString = Array.from(params.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")
    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest()
    const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex")
    if (!timingSafeEqualHex(calculatedHash, receivedHash)) return null

    const rawUser = params.get("user")
    if (!rawUser) return null
    const user = JSON.parse(rawUser) as TelegramIdentity
    if (!user || !/^\d+$/.test(String(user.id))) return null
    return { ...user, id: String(user.id) }
  } catch {
    return null
  }
}

export async function linkTelegramIdentity(input: {
  telegramId: string
  phone?: string | null
  username?: string | null
  name?: string | null
  image?: string | null
}) {
  const phone = input.phone ? normalizePhone(input.phone) : null
  const byTelegram = await prisma.user.findUnique({ where: { telegramId: input.telegramId } })
  const byPhone = phone ? await prisma.user.findUnique({ where: { phone } }) : null
  if (byTelegram && byPhone && byTelegram.id !== byPhone.id) {
    throw new TelegramIdentityConflictError("Telegram ID and phone belong to different accounts")
  }

  const user = byTelegram || byPhone
  const displayName = input.name?.trim() || user?.name || `Пользователь ${input.telegramId}`
  if (user) {
    return prisma.user.update({
      where: { id: user.id },
      data: {
        telegramId: input.telegramId,
        phone: phone || user.phone,
        telegramUsername: input.username || user.telegramUsername,
        telegramVerifiedAt: new Date(),
        name: displayName,
        image: input.image || user.image,
      },
    })
  }

  return prisma.user.create({
    data: {
      email: `tg_${input.telegramId}@telegram.local`,
      name: displayName,
      image: input.image || null,
      phone,
      telegramId: input.telegramId,
      telegramUsername: input.username || null,
      telegramVerifiedAt: new Date(),
      hashedPassword: `TELEGRAM_${crypto.randomBytes(24).toString("hex")}`,
      role: "USER",
    },
  })
}

export async function getVerifiedTelegramUser(telegramId: string) {
  const user = await prisma.user.findFirst({
    where: {
      telegramId,
      telegramVerifiedAt: { not: null },
      phone: { not: null },
    },
  })
  return isTelegramUserRegistered(user) ? user : null
}

export async function saveTelegramRegistrationEmail(telegramId: string, emailInput: string) {
  const email = emailInput.trim().toLowerCase()
  if (email.length > 254 || isInternalTelegramEmail(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new TelegramRegistrationError("INVALID_EMAIL", "Введите корректную почту, например name@example.com")
  }

  const user = await prisma.user.findUnique({ where: { telegramId } })
  if (!user) throw new TelegramRegistrationError("NOT_FOUND", "Сначала подтвердите телефон")
  if (getTelegramRegistrationStep(user) !== "email") {
    throw new TelegramRegistrationError("WRONG_STEP", "Этот шаг уже завершён")
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing && existing.id !== user.id) {
    throw new TelegramRegistrationError("EMAIL_TAKEN", "Эта почта уже связана с другим аккаунтом")
  }

  return prisma.user.update({
    where: { id: user.id },
    data: { email, emailVerified: null },
  })
}

export async function completeTelegramRegistration(telegramId: string, password: string) {
  if (password.length < 8 || password.length > 128) {
    throw new TelegramRegistrationError("INVALID_PASSWORD", "Пароль должен содержать от 8 до 128 символов")
  }

  const user = await prisma.user.findUnique({ where: { telegramId } })
  if (!user) throw new TelegramRegistrationError("NOT_FOUND", "Сначала подтвердите телефон")
  if (getTelegramRegistrationStep(user) !== "password") {
    throw new TelegramRegistrationError("WRONG_STEP", "Сначала укажите почту")
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  return prisma.user.update({
    where: { id: user.id },
    data: { hashedPassword, emailVerified: new Date() },
  })
}

export async function telegramApi<T = unknown>(method: string, payload: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured")
  const requestBody = JSON.stringify(payload)
  return new Promise<T>((resolve, reject) => {
    // Обрыв соединения приходит и после того, как промис уже разрешён.
    // Без единой точки завершения такой `ECONNRESET` всплывал как
    // uncaughtException и мог уронить процесс приложения.
    let settled = false
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      reject(error)
    }
    const succeed = (value: T) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    const request = https.request({
      hostname: "api.telegram.org",
      family: 4,
      port: 443,
      path: `/bot${token}/${method}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(requestBody),
      },
      timeout: 20_000,
    }, (response) => {
      let responseBody = ""
      response.setEncoding("utf8")
      // Поток ответа тоже эмитит ошибки: без обработчика разрыв на этой
      // стадии остаётся необработанным.
      response.on("error", fail)
      response.on("data", (chunk) => {
        responseBody += chunk
        if (responseBody.length > 2_000_000) {
          fail(new Error("Telegram API response is too large"))
          request.destroy()
        }
      })
      response.on("end", () => {
        let body: TelegramApiResponse<T> | null = null
        try { body = JSON.parse(responseBody) as TelegramApiResponse<T> } catch { /* handled below */ }
        if ((response.statusCode || 500) >= 400 || !body?.ok) {
          fail(new Error(body?.description || `Telegram API ${response.statusCode || 500}`))
          return
        }
        succeed(body.result as T)
      })
    })
    request.on("error", fail)
    request.on("timeout", () => {
      fail(new Error(`Telegram API ${method} timed out`))
      request.destroy()
    })
    request.end(requestBody)
  })
}

export async function telegramPhotoApi<T = unknown>(payload: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured")

  const photo = await readFile(path.join(process.cwd(), "public", "images", "telegram-service-infographic.png"))
  const boundary = `----LeWheelTelegram${crypto.randomBytes(12).toString("hex")}`
  const chunks: Buffer[] = []
  for (const [key, rawValue] of Object.entries(payload)) {
    if (rawValue === undefined || rawValue === null) continue
    const value = typeof rawValue === "object" ? JSON.stringify(rawValue) : String(rawValue)
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`))
  }
  chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="lewheel-service.png"\r\nContent-Type: image/png\r\n\r\n`))
  chunks.push(photo)
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`))
  const requestBody = Buffer.concat(chunks)

  return new Promise<T>((resolve, reject) => {
    // Та же защита, что и в `telegramApi`: обрыв соединения после разрешения
    // промиса не должен становиться необработанным исключением.
    let settled = false
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      reject(error)
    }
    const succeed = (value: T) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    const request = https.request({
      hostname: "api.telegram.org",
      family: 4,
      port: 443,
      path: `/bot${token}/sendPhoto`,
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": requestBody.length,
      },
      timeout: 30_000,
    }, (response) => {
      let responseBody = ""
      response.setEncoding("utf8")
      response.on("error", fail)
      response.on("data", (chunk) => {
        responseBody += chunk
        if (responseBody.length > 2_000_000) {
          fail(new Error("Telegram API response is too large"))
          request.destroy()
        }
      })
      response.on("end", () => {
        let body: TelegramApiResponse<T> | null = null
        try { body = JSON.parse(responseBody) as TelegramApiResponse<T> } catch { /* handled below */ }
        if ((response.statusCode || 500) >= 400 || !body?.ok) {
          fail(new Error(body?.description || `Telegram API ${response.statusCode || 500}`))
          return
        }
        succeed(body.result as T)
      })
    })
    request.on("error", fail)
    request.on("timeout", () => {
      fail(new Error("Telegram API sendPhoto timed out"))
      request.destroy()
    })
    request.end(requestBody)
  })
}

export function getTelegramMiniAppUrl() {
  const value = process.env.TELEGRAM_MINI_APP_URL?.trim()
  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}

export function getTelegramBotUsername() {
  const raw = (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME || "").trim().replace(/^@/, "")
  return /^[A-Za-z0-9_]{5,}$/.test(raw) ? raw : null
}

export function isModeratedChat(chatId: string) {
  if (process.env.TELEGRAM_MODERATION_ENABLED !== "true") return false
  const chats = (process.env.TELEGRAM_MODERATION_CHAT_IDS || "").split(",").map((value) => value.trim()).filter(Boolean)
  return chats.includes(chatId) || chats.includes("*")
}

async function getTelegramBotProfile() {
  if (!botProfilePromise) botProfilePromise = telegramApi<TelegramBotProfile>("getMe", {})
  try {
    return await botProfilePromise
  } catch (error) {
    botProfilePromise = null
    throw error
  }
}

/**
 * `TELEGRAM_MODERATION_CHAT_IDS` scopes groups that may be moderated, while
 * this check confirms the bot has Telegram's delete permission in that group.
 * A failed API check always denies moderation rather than attempting deletion.
 */
export async function canModerateTelegramChat(chatId: string) {
  if (!isModeratedChat(chatId)) return false

  const cached = moderatedChatCapability.get(chatId)
  if (cached && cached.expiresAt > Date.now()) return cached.allowed

  try {
    const bot = await getTelegramBotProfile()
    const membership = await telegramApi<TelegramChatMember>("getChatMember", { chat_id: chatId, user_id: bot.id })
    const owner = membership.status === "creator" || membership.status === "owner"
    const allowed = owner || (membership.status === "administrator" && membership.can_delete_messages === true)
    moderatedChatCapability.set(chatId, { allowed, expiresAt: Date.now() + CHAT_MODERATION_CACHE_TTL_MS })
    return allowed
  } catch (error) {
    console.error("Telegram moderation permission check failed:", error)
    moderatedChatCapability.set(chatId, { allowed: false, expiresAt: Date.now() + 30_000 })
    return false
  }
}

/** Проверяет только роль бота в чате — без whitelist модерации и права удаления. */
export async function isTelegramChatAdministrator(chatId: string) {
  const cached = adminChatCapability.get(chatId)
  if (cached && cached.expiresAt > Date.now()) return cached.allowed

  try {
    const bot = await getTelegramBotProfile()
    const membership = await telegramApi<TelegramChatMember>("getChatMember", { chat_id: chatId, user_id: bot.id })
    const allowed = membership.status === "administrator" || membership.status === "creator" || membership.status === "owner"
    adminChatCapability.set(chatId, { allowed, expiresAt: Date.now() + CHAT_MODERATION_CACHE_TTL_MS })
    return allowed
  } catch (error) {
    console.error("Telegram administrator permission check failed:", error)
    adminChatCapability.set(chatId, { allowed: false, expiresAt: Date.now() + 30_000 })
    return false
  }
}
