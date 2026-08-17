import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      accountStatus: string
    } & DefaultSession["user"]
  }

  interface User {
    role: string
    accountStatus: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    accountStatus: string
  }
}

export {}
