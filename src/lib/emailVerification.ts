import crypto from "crypto"
import { prisma } from "@/lib/prisma"

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000
const PASSWORD_RESET_IDENTIFIER_PREFIX = "password-reset:"

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase()
}

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

function siteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || ""
  try {
    const parsed = new URL(value)
    return parsed.hostname === "example.ru" ? null : parsed.toString().replace(/\/$/, "")
  } catch {
    return null
  }
}

export function isEmailDeliveryConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && siteUrl())
}

export async function issueEmailVerification(emailInput: string) {
  const email = normalizeEmail(emailInput)
  return issueToken(email)
}

async function issueToken(identifier: string) {
  const rawToken = crypto.randomBytes(32).toString("base64url")
  const expires = new Date(Date.now() + TOKEN_TTL_MS)

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: { identifier, token: tokenHash(rawToken), expires },
    }),
  ])

  return { token: rawToken, expires }
}

export async function verifyEmailToken(rawToken: string) {
  const token = tokenHash(rawToken)
  const record = await prisma.verificationToken.findUnique({ where: { token } })
  if (!record || record.expires <= new Date()) {
    if (record) await prisma.verificationToken.delete({ where: { token } })
    return null
  }

  const user = await prisma.user.findUnique({ where: { email: record.identifier } })
  if (!user) {
    await prisma.verificationToken.delete({ where: { token } })
    return null
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } }),
    prisma.verificationToken.delete({ where: { token } }),
  ])

  return user
}

export async function sendEmailVerification(emailInput: string, name?: string | null) {
  const email = normalizeEmail(emailInput)
  const baseUrl = siteUrl()
  if (!isEmailDeliveryConfigured() || !baseUrl) {
    throw new Error("Email delivery is not configured")
  }

  const { token } = await issueEmailVerification(email)
  const verificationUrl = new URL(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, baseUrl).toString()
  const greeting = escapeHtml(name?.trim() || "Здравствуйте")
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    /* Зависшая почтовая служба не должна держать воркер: forgot-password
       — публичный маршрут. */
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: "Подтвердите email в Авторынке",
      html: `<div style="font-family:Arial,sans-serif;color:#18181b;line-height:1.55"><h2>Подтвердите email</h2><p>${greeting}!</p><p>Нажмите кнопку, чтобы завершить регистрацию в Авторынке. Ссылка действует 24 часа.</p><p><a href="${verificationUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:var(--market-primary);color:#fff;text-decoration:none;font-weight:700">Подтвердить email</a></p><p style="color:#71717a;font-size:13px">Если вы не создавали аккаунт, просто проигнорируйте это письмо.</p></div>`,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Email provider rejected the request: ${response.status} ${body.slice(0, 200)}`)
  }
}

export async function sendPasswordResetEmail(emailInput: string, name?: string | null) {
  const email = normalizeEmail(emailInput)
  const baseUrl = siteUrl()
  if (!isEmailDeliveryConfigured() || !baseUrl) {
    throw new Error("Email delivery is not configured")
  }

  const { token } = await issueToken(`${PASSWORD_RESET_IDENTIFIER_PREFIX}${email}`)
  const resetUrl = new URL(`/auth/reset-password?token=${encodeURIComponent(token)}`, baseUrl).toString()
  const greeting = escapeHtml(name?.trim() || "Здравствуйте")
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    /* Зависшая почтовая служба не должна держать воркер: forgot-password
       — публичный маршрут. */
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: "Сброс пароля в Авторынке",
      html: `<div style="font-family:Arial,sans-serif;color:#18181b;line-height:1.55"><h2>Сброс пароля</h2><p>${greeting}!</p><p>Нажмите кнопку, чтобы установить новый пароль. Ссылка действует 24 часа и станет недействительной после использования.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:var(--market-primary);color:#fff;text-decoration:none;font-weight:700">Установить новый пароль</a></p><p style="color:#71717a;font-size:13px">Если вы не запрашивали сброс, просто проигнорируйте это письмо.</p></div>`,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Email provider rejected the request: ${response.status} ${body.slice(0, 200)}`)
  }
}

/** Consumes a one-time reset token, updates the password and invalidates active sessions. */
export async function resetPasswordByToken(rawToken: string, hashedPassword: string) {
  const token = tokenHash(rawToken)
  const record = await prisma.verificationToken.findUnique({ where: { token } })
  const expiresAt = record?.expires
  if (!record || !expiresAt || expiresAt <= new Date()) {
    if (record && expiresAt && expiresAt <= new Date()) await prisma.verificationToken.delete({ where: { token } })
    return null
  }
  if (!record.identifier.startsWith(PASSWORD_RESET_IDENTIFIER_PREFIX)) {
    return null
  }

  const email = record.identifier.slice(PASSWORD_RESET_IDENTIFIER_PREFIX.length)
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) {
    await prisma.verificationToken.delete({ where: { token } })
    return null
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { hashedPassword } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.verificationToken.delete({ where: { token } }),
  ])

  return user
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }
  return value.replace(/[&<>'"]/g, (char) => entities[char] || char)
}
