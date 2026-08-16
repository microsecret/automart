import { createHash, randomBytes } from "crypto"
import type { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const SUPPORT_COOKIE_NAME = "lewheel_support_session"
export const SUPPORT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

export const SUPPORT_STATUSES = ["OPEN", "WAITING_OPERATOR", "IN_PROGRESS", "CLOSED"] as const
export const SUPPORT_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const

export type SupportStatus = (typeof SUPPORT_STATUSES)[number]
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number]

export function isSupportStatus(value: unknown): value is SupportStatus {
  return typeof value === "string" && SUPPORT_STATUSES.includes(value as SupportStatus)
}

export function isSupportPriority(value: unknown): value is SupportPriority {
  return typeof value === "string" && SUPPORT_PRIORITIES.includes(value as SupportPriority)
}

function hashGuestToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

function createGuestToken() {
  return randomBytes(32).toString("base64url")
}

export function setSupportCookie(response: NextResponse, token: string) {
  response.cookies.set(SUPPORT_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SUPPORT_COOKIE_MAX_AGE,
  })
}

export function normalizeSupportName(value: unknown) {
  if (typeof value !== "string") return null
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, 80)
  return normalized.length >= 2 ? normalized : null
}

export function normalizeSupportEmail(value: unknown) {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase().slice(0, 254)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null
}

export function normalizeSupportPhone(value: unknown) {
  if (typeof value !== "string") return null
  const digits = value.replace(/\D/g, "").slice(0, 15)
  if (digits.length < 10) return null
  return digits.startsWith("8") && digits.length === 11 ? `7${digits.slice(1)}` : digits
}

type ResolveVisitorOptions = {
  userId?: string | null
  createIfMissing?: boolean
}

export async function resolveVisitorSupportTicket(request: NextRequest, options: ResolveVisitorOptions = {}) {
  const userId = options.userId || null
  const rawToken = request.cookies.get(SUPPORT_COOKIE_NAME)?.value?.trim()

  if (rawToken && rawToken.length >= 32 && rawToken.length <= 128) {
    const ticket = await prisma.supportTicket.findUnique({
      where: { publicTokenHash: hashGuestToken(rawToken) },
    })

    if (ticket) {
      // После выхода из аккаунта гостевая cookie не должна раскрывать историю
      // обращения, уже привязанного к зарегистрированному пользователю.
      if (ticket.userId && ticket.userId !== userId) {
        return { ticket: null, newGuestToken: null }
      }

      if (!ticket.userId && userId) {
        const attached = await prisma.supportTicket.update({
          where: { id: ticket.id },
          data: { userId },
        })
        return { ticket: attached, newGuestToken: null }
      }

      return { ticket, newGuestToken: null }
    }
  }

  if (userId) {
    const userTicket = await prisma.supportTicket.findFirst({
      where: { userId, status: { not: "CLOSED" } },
      orderBy: { updatedAt: "desc" },
    })
    if (userTicket) return { ticket: userTicket, newGuestToken: null }
  }

  if (!options.createIfMissing) return { ticket: null, newGuestToken: null }

  if (userId) {
    const ticket = await prisma.supportTicket.create({
      data: { userId, publicTokenHash: hashGuestToken(createGuestToken()) },
    })
    return { ticket, newGuestToken: null }
  }

  const newGuestToken = createGuestToken()
  const ticket = await prisma.supportTicket.create({
    data: { publicTokenHash: hashGuestToken(newGuestToken) },
  })
  return { ticket, newGuestToken }
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export async function findSupportKnowledge(message: string) {
  const articles = await prisma.supportKnowledgeArticle.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })
  const queryTokens = new Set(normalizeSearchText(message).split(" ").filter((token) => token.length > 2))

  const ranked = articles
    .map((article) => {
      const haystack = normalizeSearchText(`${article.title} ${article.summary} ${article.keywords} ${article.content}`)
      const keywordTokens = normalizeSearchText(article.keywords).split(" ").filter(Boolean)
      let score = 0
      for (const token of queryTokens) {
        if (haystack.includes(token)) score += 2
        if (keywordTokens.some((keyword) => keyword.includes(token) || token.includes(keyword))) score += 3
      }
      return { article, score }
    })
    .sort((a, b) => b.score - a.score || a.article.sortOrder - b.article.sortOrder)

  return ranked[0]?.score > 0 ? ranked[0].article : null
}

export async function buildSupportKnowledgeAnswer(message: string) {
  const article = await findSupportKnowledge(message)
  if (!article) {
    return {
      answer:
        "Я пока не нашёл точную инструкцию. Нажмите «Позвать оператора» — обращение сохранится, и сотрудник увидит всю переписку.",
      article: null,
    }
  }

  return {
    answer: article.content,
    article: {
      id: article.id,
      title: article.title,
      actionLabel: article.link ? "Открыть инструкцию" : null,
      actionUrl: article.link,
    },
  }
}

export function requestsHumanOperator(message: string) {
  return /оператор|человек|сотрудник|поддержк|позов|связаться|жалоб|претензи/i.test(message)
}

export const SUPPORT_QUICK_REPLIES = [
  "Как зарегистрироваться?",
  "Как привязать Telegram?",
  "Как подать объявление?",
  "Как купить авто с аукциона?",
]
