#!/usr/bin/env node

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const suspiciousAccountPattern = /(?:demo|test|fake|example|seed|audit|демо|тест|пример)/iu
const suspiciousNewsPattern = /(?:\b(?:demo|test|fake|example|seed|audit)\b|демо(?:-|\s+)?новост|тестов(?:ая|ые|ое)\s+новост|пример\s+новост)/iu

async function main() {
  const [users, news, newsByChannel, auctionViews] = await Promise.all([
    prisma.user.findMany({ select: { id: true, role: true, name: true, email: true, telegramId: true, emailVerified: true, createdAt: true } }),
    prisma.news.findMany({
      select: { id: true, title: true, content: true, sourceKey: true, sourceChannel: true, sourceUrl: true, publishedAt: true, views: true },
      orderBy: [{ views: "desc" }, { publishedAt: "desc" }],
    }),
    prisma.news.groupBy({ by: ["sourceChannel"], _count: { _all: true }, _sum: { views: true }, orderBy: { _count: { sourceChannel: "desc" } } }),
    prisma.auctionListing.aggregate({ _sum: { viewCount: true }, _max: { viewCount: true }, _avg: { viewCount: true } }),
  ])

  const titleCounts = new Map()
  for (const article of news) {
    const key = article.title.trim().toLocaleLowerCase("ru-RU")
    titleCounts.set(key, (titleCounts.get(key) || 0) + 1)
  }
  const futureCutoff = new Date(Date.now() + 5 * 60_000)
  const suspiciousUsers = users.filter((user) => suspiciousAccountPattern.test(`${user.name || ""} ${user.email || ""}`))
  const suspiciousNews = news.filter((article) => suspiciousNewsPattern.test(article.title))
  const duplicateTitles = [...titleCounts.values()].filter((count) => count > 1).length

  console.log(JSON.stringify({
    auditedAt: new Date().toISOString(),
    users: {
      total: users.length,
      byRole: Object.fromEntries([...new Set(users.map((user) => user.role))].map((role) => [role, users.filter((user) => user.role === role).length])),
      telegramLinked: users.filter((user) => Boolean(user.telegramId)).length,
      emailVerified: users.filter((user) => Boolean(user.emailVerified)).length,
      suspiciousDemoOrTestAccounts: suspiciousUsers.length,
    },
    news: {
      total: news.length,
      withViews: news.filter((article) => article.views > 0).length,
      totalViews: news.reduce((total, article) => total + article.views, 0),
      maximumViews: news[0]?.views || 0,
      emptyContent: news.filter((article) => !article.content.trim()).length,
      missingSourceKey: news.filter((article) => !article.sourceKey).length,
      missingSourceUrl: news.filter((article) => !article.sourceUrl).length,
      futurePublishedAt: news.filter((article) => article.publishedAt > futureCutoff).length,
      duplicateTitles,
      suspiciousDemoOrTestTitles: suspiciousNews.length,
      suspiciousTitleSamples: suspiciousNews.slice(0, 20).map((article) => ({ id: article.id, title: article.title })),
      byChannel: newsByChannel.map((item) => ({ channel: item.sourceChannel || "EDITORIAL", count: item._count._all, views: item._sum.views || 0 })),
      mostViewed: news.slice(0, 10).map((article) => ({ id: article.id, title: article.title, views: article.views, publishedAt: article.publishedAt })),
    },
    auctions: {
      totalViews: auctionViews._sum.viewCount || 0,
      maximumViews: auctionViews._max.viewCount || 0,
      averageViews: Math.round((auctionViews._avg.viewCount || 0) * 10) / 10,
    },
  }, null, 2))
}

main()
  .catch((error) => {
    console.error("Production content audit failed", error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
