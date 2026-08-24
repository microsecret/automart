#!/usr/bin/env node
/**
 * Сторож ленты новостей.
 *
 * Смотрит, когда пришла последняя новость, и пишет вывод в журнал.
 * Молчание дольше суток означает, что внешний редактор не может
 * достучаться до площадки — чаще всего из-за разошедшегося
 * NEWS_IMPORT_TOKEN.
 *
 * Запускается по расписанию раз в час. Ничего не чинит сам: решение
 * менять токен — ручное, и принимать его автоматически нельзя.
 */

import { PrismaClient } from "@prisma/client"
import { checkNewsFeed, isFeedBroken } from "../src/lib/news-feed-health.js"

const prisma = new PrismaClient()

function stamp() {
  return new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })
}

async function main() {
  const last = await prisma.news.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })

  const check = checkNewsFeed(last?.createdAt ?? null)

  /* За сутки — чтобы в журнале рядом с тревогой была видна и скорость
     поступления: «нет новостей» при 40 статьях за сутки и при нуле —
     разные истории. */
  const dayAgo = new Date(Date.now() - 86_400_000)
  const perDay = await prisma.news.count({ where: { createdAt: { gte: dayAgo } } })

  const prefix = isFeedBroken(check) ? "ТРЕВОГА" : check.state === "quiet" ? "тихо" : "ок"
  console.log(`[${stamp()}] ${prefix}: ${check.message} За сутки: ${perDay}.`)

  await prisma.$disconnect()

  /* Ненулевой код — чтобы сбой был заметен и в почте cron, а не только
     в журнале, который никто не открывает. */
  if (isFeedBroken(check)) process.exit(1)
}

main().catch(async (error) => {
  console.error(`[${stamp()}] Сторож новостей упал:`, error?.message || error)
  await prisma.$disconnect().catch(() => {})
  process.exit(2)
})
