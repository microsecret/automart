import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildPublicAuctionPolicy } from "@/lib/auction-public-catalog"

export const dynamic = "force-dynamic"

/* Счётчики на главной пересчитывались при каждом открытии страницы.

   Семь подсчётов по всем таблицам сразу: машины, запчасти, лоты,
   объявления, пользователи, новости и разбивка лотов по странам. Лотов
   уже четыре с половиной тысячи, и каждый посетитель главной запускал
   полный перебор заново.

   Цифры вида «6 объявлений» меняются раз в час, а не в секунду, поэтому
   минуты хранения хватает. Кэш живёт в памяти процесса, а не в заголовках
   ответа: заголовки зависят от настроек прокси, а этот работает всегда. */
const CACHE_TTL_MS = 60_000

type StatsPayload = {
  vehicles: number
  parts: number
  auctions: number
  listings: number
  news: number
  auctionByCountry: Record<string, number>
}

let cache: { at: number; payload: StatsPayload } | null = null

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.payload)
  }

  try {
    const publicAuctionWhere = buildPublicAuctionPolicy().where
    /* Считаем только то, что показывается.

       Здесь было семь подсчётов по всем таблицам сразу, но страница
       берёт из ответа лишь число лотов и разбивку по странам — остальные
       шесть считались впустую на каждое открытие главной.

       Осталось четыре запроса вместо семи: число пользователей на витрине
       не показывается нигде, а общее число объявлений складывается из
       машин и запчастей.

       Считаем так же, как видит покупатель, — без удалённых и без снятых
       с публикации: на главной значилось восемь объявлений там, где
       открыть можно было семь. */
    const visibleListings = { deletedAt: null, status: "ACTIVE" as const }
    const [auctions, vehicles, parts, news] = await Promise.all([
      prisma.auctionListing.count({ where: publicAuctionWhere }),
      prisma.listing.count({ where: { ...visibleListings, vehicle: { isNot: null } } }),
      prisma.listing.count({ where: { ...visibleListings, part: { isNot: null } } }),
      prisma.news.count(),
    ])
    // Число объявлений — это машины и запчасти вместе, отдельного запроса
    // не требуется.
    const listings = vehicles + parts

    // Статистика аукционов по странам
    const auctionByCountry = await prisma.auctionListing.groupBy({
      by: ["country"],
      where: publicAuctionWhere,
      _count: true,
    })

    const payload: StatsPayload = {
      vehicles, parts, auctions, listings, news,
      auctionByCountry: auctionByCountry.reduce((acc, c) => {
        acc[c.country] = c._count
        return acc
      }, {} as Record<string, number>),
    }
    cache = { at: now, payload }
    return NextResponse.json(payload)
  } catch {
    // Ошибку не кэшируем: следующий запрос должен попробовать снова.
    // Если есть прежний удачный ответ, он лучше нулей на главной.
    if (cache) return NextResponse.json(cache.payload)
    return NextResponse.json({ vehicles: 0, parts: 0, auctions: 0, listings: 0, news: 0 })
  }
}
