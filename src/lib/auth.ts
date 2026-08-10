import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { consumeTelegramOtp, linkTelegramIdentity, verifyTelegramInitData } from "@/lib/telegram"
import { normalizeUserRole } from "@/lib/permissions"
import { getClientIp, rateLimit } from "@/lib/rate-limit"

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null
        const email = credentials.email.trim().toLowerCase()
        const ipLimit = rateLimit(`auth:password:ip:${getClientIp({ headers: request.headers ?? new Headers() })}`, { windowMs: 15 * 60_000, maxRequests: 15 })
        const emailLimit = rateLimit(`auth:password:email:${email}`, { windowMs: 15 * 60_000, maxRequests: 8 })
        if (!ipLimit.success || !emailLimit.success) throw new Error("RATE_LIMITED")

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password, user.hashedPassword || "")
        if (!valid) return null
        if (!user.emailVerified) throw new Error("EMAIL_NOT_VERIFIED")
        return { id: user.id, email: user.email, name: user.name, role: normalizeUserRole(user.role) }
      },
    }),
    CredentialsProvider({
      id: "phone-otp",
      name: "Telegram OTP",
      credentials: {
        phone: { label: "Телефон", type: "tel" },
        code: { label: "Код из Telegram", type: "text" },
      },
      async authorize(credentials: any) {
        const user = await consumeTelegramOtp(credentials?.phone, credentials?.code)
        if (!user?.telegramVerifiedAt) return null
        return { id: user.id, email: user.email, name: user.name, image: user.image, role: normalizeUserRole(user.role) }
      },
    }),
    CredentialsProvider({
      id: "telegram",
      name: "Telegram Mini App",
      credentials: { initData: { label: "Telegram initData", type: "text" } },
      async authorize(credentials: any) {
        const botToken = process.env.TELEGRAM_BOT_TOKEN
        if (!botToken || !credentials?.initData) return null
        const telegramUser = verifyTelegramInitData(credentials.initData, botToken)
        if (!telegramUser) return null
        const user = await linkTelegramIdentity({
          telegramId: telegramUser.id,
          username: telegramUser.username,
          name: [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" "),
          image: telegramUser.photo_url,
        })
        return { id: user.id, email: user.email, name: user.name, image: user.image, role: normalizeUserRole(user.role) }
      },
    }),
  ],
  session: { strategy: "jwt" as const },
  callbacks: {
    async session({ session, token }: any) {
      if (token) {
        session.user.id = token.id
        session.user.role = normalizeUserRole(token.role)
      }
      return session
    },
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id
        token.role = normalizeUserRole((user as any).role)
      }
      return token
    },
  },
  pages: {
    signIn: "/auth/signin",
    signUp: "/auth/signup",
  },
}
