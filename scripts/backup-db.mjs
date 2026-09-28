// Ежедневная резервная копия базы SQLite.
//
// До 28.09.2026 регулярной копии не было вовсе: последние ручные — в
// августе, а база (266 МБ) хранит пользователей, объявления и переписку.
//
// VACUUM INTO пишет согласованный снимок, не останавливая сайт, и
// работает и в режиме WAL — простое копирование файла в WAL теряло бы
// последние записи. Снимок сжимается, хранятся семь последних.
import { PrismaClient } from "@prisma/client"
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs"
import { pipeline } from "node:stream/promises"
import { createGzip } from "node:zlib"
import path from "node:path"

const DIR = process.env.DB_BACKUP_DIR || "/root/AutoMart-db-backups"
const KEEP = Number(process.env.DB_BACKUP_KEEP || 7)

const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")
const raw = path.join(DIR, `dev-${stamp}.db`)
mkdirSync(DIR, { recursive: true })

const prisma = new PrismaClient()
try {
  if (existsSync(raw)) unlinkSync(raw)
  await prisma.$executeRawUnsafe(`VACUUM INTO '${raw.replace(/'/g, "''")}'`)
} finally {
  await prisma.$disconnect()
}

await pipeline(createReadStream(raw), createGzip({ level: 6 }), createWriteStream(`${raw}.gz`))
unlinkSync(raw)

const copies = readdirSync(DIR).filter((name) => /^dev-\d+\.db\.gz$/.test(name)).sort()
for (const old of copies.slice(0, Math.max(0, copies.length - KEEP))) unlinkSync(path.join(DIR, old))

const size = (statSync(`${raw}.gz`).size / 1024 / 1024).toFixed(1)
console.log(`[${new Date().toISOString()}] Копия базы: ${raw}.gz, ${size} МБ; хранится ${Math.min(copies.length, KEEP)}`)
