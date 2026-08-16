#!/usr/bin/env node

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const now = new Date()
const staleCutoff = new Date(now.getTime() - 8 * 60 * 60 * 1_000)
const foreignText = /[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/

function imageCount(listing) {
  try {
    const values = listing.images ? JSON.parse(listing.images) : []
    return Array.isArray(values) ? values.filter((value) => typeof value === "string" && value.startsWith("http")).length : 0
  } catch {
    return 0
  }
}

async function main() {
  const [sourceStatus, active, latestRuns, rates] = await Promise.all([
    prisma.auctionListing.groupBy({
      by: ["source", "status"],
      _count: { _all: true },
      orderBy: [{ source: "asc" }, { status: "asc" }],
    }),
    prisma.auctionListing.findMany({
      where: { status: "ACTIVE" },
      select: {
        source: true, year: true, manufacturedMonth: true, lastChecked: true,
        sourceLastSeenAt: true, sourceMissingChecks: true, images: true, imageUrl: true,
        power: true, color: true, location: true, descriptionRu: true, specsRu: true,
        isTranslated: true, sourceCurrency: true, pricingUpdatedAt: true,
      },
    }),
    prisma.auctionSyncRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 12,
      select: {
        source: true, syncKind: true, status: true, discovered: true, imported: true,
        created: true, updated: true, failed: true, expired: true, skippedByPolicy: true,
        excludedByPolicy: true, startedAt: true, completedAt: true, error: true,
      },
    }),
    prisma.exchangeRate.findMany({
      orderBy: { currency: "asc" },
      select: { currency: true, rateToRub: true, source: true, effectiveAt: true, updatedAt: true },
    }),
  ])

  const imageCounts = active.map(imageCount)
  const metrics = {
    active: active.length,
    activeBySource: Object.fromEntries([...new Set(active.map((item) => item.source))].map((source) => [source, active.filter((item) => item.source === source).length])),
    staleMoreThan8Hours: active.filter((item) => !item.lastChecked || item.lastChecked < staleCutoff).length,
    pendingSecondUnavailableCheck: active.filter((item) => item.sourceMissingChecks === 1).length,
    outsideFiveYearPolicy: active.filter((item) => {
      const latestPossibleRelease = item.manufacturedMonth?.match(/^(\d{4})-(0[1-9]|1[0-2])$/)
        ? new Date(Number(item.manufacturedMonth.slice(0, 4)), Number(item.manufacturedMonth.slice(5, 7)), 0)
        : new Date(item.year, 11, 31)
      return latestPossibleRelease < new Date(now.getFullYear() - 5, now.getMonth(), now.getDate())
    }).length,
    withoutManufacturedMonth: active.filter((item) => !item.manufacturedMonth).length,
    withoutPower: active.filter((item) => !item.power).length,
    foreignColor: active.filter((item) => Boolean(item.color && foreignText.test(item.color))).length,
    foreignLocation: active.filter((item) => Boolean(item.location && foreignText.test(item.location))).length,
    withoutRussianContent: active.filter((item) => !item.descriptionRu && !item.specsRu).length,
    imageGallery: {
      zero: imageCounts.filter((count) => count === 0).length,
      one: imageCounts.filter((count) => count === 1).length,
      twoToNine: imageCounts.filter((count) => count >= 2 && count < 10).length,
      tenOrMore: imageCounts.filter((count) => count >= 10).length,
      average: imageCounts.length ? Math.round(imageCounts.reduce((sum, count) => sum + count, 0) / imageCounts.length * 10) / 10 : 0,
      max: imageCounts.length ? Math.max(...imageCounts) : 0,
    },
  }

  console.log(JSON.stringify({
    auditedAt: now.toISOString(),
    sourceStatus: sourceStatus.map((row) => ({ source: row.source, status: row.status, count: row._count._all })),
    metrics,
    rates,
    latestRuns,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error("Production data audit failed", error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
