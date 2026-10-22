import { PrismaClient } from "@prisma/client"
import { sharedPrismaClient, sqliteConnectionUrl } from "./prisma-connection-policy.mjs"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const databaseUrl = sqliteConnectionUrl(process.env.DATABASE_URL)

// Share in production too: independently bundled routes must not create
// independent SQLite writer pools in the same Next process.
export const prisma = sharedPrismaClient(globalForPrisma, () =>
  new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  }),
)
