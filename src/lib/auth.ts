import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import crypto from "node:crypto"
import { prisma } from "@/lib/prisma"
import { getVerifiedTelegramUser, isInternalTelegramEmail, normalizePhone, verifyTelegramInitData } from "@/lib/telegram"
import { normalizeUserRole } from "@/lib/permissions"
import { getClientIp, rateLimit } from "@/lib/rate-limit"
import type { NextAuthOptions } from "next-auth"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Почта или телефон", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials, request) {
        const identifier = String(credentials?.identifier || credentials?.email || "").trim()
        if (!identifier || !credentials?.password) return null
        const email = identifier.includes("@") ? identifier.toLowerCase() : null
        const phone = email ? null : normalizePhone(identifier)
        if (!email && !phone) return null
        const identifierKey = crypto.createHash("sha256").update(email || phone || "invalid").digest("hex")
        const ipLimit = rateLimit(`auth:password:ip:${getClientIp({ headers: request.headers ?? new Headers() })}`, { windowMs: 15 * 60_000, maxRequests: 15 })
        const identifierLimit = rateLimit(`auth:password:identifier:${identifierKey}`, { windowMs: 15 * 60_000, maxRequests: 8 })
        if (!ipLimit.success || !identifierLimit.success) throw new Error("RATE_LIMITED")

        const user = email
          ? await prisma.user.findUnique({ where: { email } })
          : await prisma.user.findUnique({ where: { phone: phone! } })
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password, user.hashedPassword || "")
        if (!valid) return null
        if (user.accountStatus === "BANNED") throw new Error("ACCOUNT_BANNED")
        if (user.accountStatus === "RESTRICTED") throw new Error("ACCOUNT_RESTRICTED")
        if (!user.emailVerified) throw new Error("EMAIL_NOT_VERIFIED")
        return { id: user.id, email: user.email, name: user.name, role: normalizeUserRole(user.role), accountStatus: user.accountStatus }
      },
    }),
    CredentialsProvider({
      id: "telegram",
      name: "Telegram Mini App",
      credentials: { initData: { label: "Telegram initData", type: "text" } },
      async authorize(credentials) {
        const botToken = process.env.TELEGRAM_BOT_TOKEN
        if (!botToken || !credentials?.initData) return null
        const telegramUser = verifyTelegramInitData(credentials.initData, botToken)
        if (!telegramUser) return null
        const user = await getVerifiedTelegramUser(telegramUser.id)
        if (!user) return null
        if (user.accountStatus !== "ACTIVE") throw new Error(user.accountStatus === "BANNED" ? "ACCOUNT_BANNED" : "ACCOUNT_RESTRICTED")
        return { id: user.id, email: user.email, name: user.name, image: user.image, role: normalizeUserRole(user.role), accountStatus: user.accountStatus }
      },
    }),
  ],
  session: { strategy: "jwt" as const },
  callbacks: {
    async session({ session, token }) {
      if (token?.id) {
        // Роль в JWT не является источником полномочий: администратор может
        // изменить её в БД между двумя запросами. Перечитываем минимум полей,
        // чтобы снятие доступа сработало сразу, а не после истечения токена.
        const currentUser = await prisma.user.findUnique({
          where: { id: String(token.id) },
          select: { id: true, name: true, email: true, image: true, role: true, accountStatus: true },
        })

        if (!currentUser) {
          // A deleted account must not keep the identity or privileges embedded
          // in an older JWT. Routes that require a user id will reject this
          // invalidated session, while role checks always see the lowest role.
          session.user.id = ""
          session.user.role = normalizeUserRole(null)
          session.user.name = null
          session.user.email = ""
          session.user.image = null
          session.user.accountStatus = "BANNED"
          return session
        }

        if (currentUser.accountStatus !== "ACTIVE") {
          session.user.id = ""
          session.user.role = normalizeUserRole(null)
          session.user.accountStatus = currentUser.accountStatus
          session.user.name = currentUser.name
          session.user.email = null
          session.user.image = currentUser.image
          return session
        }

        session.user.id = currentUser.id
        session.user.role = normalizeUserRole(currentUser.role)
        session.user.name = currentUser.name || session.user.name
        session.user.email = isInternalTelegramEmail(currentUser.email) ? null : currentUser.email || session.user.email
        session.user.image = currentUser.image || session.user.image
        session.user.accountStatus = currentUser.accountStatus
      }
      return session
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = normalizeUserRole(user.role)
        token.accountStatus = user.accountStatus
      }
      if (trigger === "update" && typeof session?.name === "string") {
        token.name = session.name
      }
      return token
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
}
