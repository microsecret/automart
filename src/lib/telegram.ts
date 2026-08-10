import crypto from "crypto"
import { prisma } from "@/lib/prisma"

const OTP_PURPOSE = "LOGIN"
const OTP_TTL_MS = 10 * 60 * 1000
const OTP_COOLDOWN_MS = 60 * 1000
const MAX_OTP_ATTEMPTS = 5

export type TelegramIdentity = {
  id: string
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
}

export class TelegramIdentityConflictError extends Error {}

function timingSafeEqualHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex")
  const rightBuffer = Buffer.from(right, "hex")
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function getTelegramSecret() {
  const secret = process.env.NEXTAUTH_SECRET || process.env.TELEGRAM_BOT_TOKEN
  if (!secret) throw new Error("NEXTAUTH_SECRET or TELEGRAM_BOT_TOKEN is required")
  return secret
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
  return prisma.user.findFirst({
    where: {
      telegramId,
      telegramVerifiedAt: { not: null },
      phone: { not: null },
    },
  })
}

function hashOtp(code: string) {
  return crypto.createHmac("sha256", getTelegramSecret()).update(code).digest("hex")
}

export async function issueTelegramOtp(phoneInput: string) {
  const phone = normalizePhone(phoneInput)
  if (!phone) return { status: "invalid" as const, phone: null, user: null }

  const user = await prisma.user.findUnique({ where: { phone } })
  if (!user?.telegramId || !user.telegramVerifiedAt) {
    return { status: "unavailable" as const, phone, user: null }
  }

  const since = new Date(Date.now() - OTP_COOLDOWN_MS)
  const recent = await prisma.telegramAuthCode.findFirst({
    where: { phone, purpose: OTP_PURPOSE, createdAt: { gt: since }, consumedAt: null },
    orderBy: { createdAt: "desc" },
  })
  if (recent) return { status: "cooldown" as const, phone, user }

  const code = crypto.randomInt(0, 100000).toString().padStart(5, "0")
  await prisma.telegramAuthCode.create({
    data: { phone, codeHash: hashOtp(code), purpose: OTP_PURPOSE, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  })
  return { status: "issued" as const, phone, user, code }
}

export async function consumeTelegramOtp(phoneInput: string, codeInput: string) {
  const phone = normalizePhone(phoneInput)
  const code = String(codeInput || "").trim()
  if (!phone || !/^\d{5}$/.test(code)) return null

  const record = await prisma.telegramAuthCode.findFirst({
    where: { phone, purpose: OTP_PURPOSE, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  })
  if (!record || record.attempts >= MAX_OTP_ATTEMPTS) return null

  const valid = timingSafeEqualHex(hashOtp(code), record.codeHash)
  if (!valid) {
    await prisma.telegramAuthCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } })
    return null
  }

  await prisma.telegramAuthCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } })
  return prisma.user.findUnique({ where: { phone } })
}

export async function telegramApi<T = unknown>(method: string, payload: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured")
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const body = await response.json().catch(() => null) as { ok?: boolean; description?: string; result?: T } | null
  if (!response.ok || !body?.ok) throw new Error(body?.description || `Telegram API ${response.status}`)
  return body.result as T
}

export function isModeratedChat(chatId: string) {
  if (process.env.TELEGRAM_MODERATION_ENABLED !== "true") return false
  const chats = (process.env.TELEGRAM_MODERATION_CHAT_IDS || "").split(",").map((value) => value.trim()).filter(Boolean)
  return chats.includes(chatId) || chats.includes("*")
}

export function isTelegramUserRegistered(user: { telegramVerifiedAt?: Date | null; phone?: string | null } | null) {
  return Boolean(user?.telegramVerifiedAt && user.phone)
}
