import type { Prisma } from "@prisma/client"
import { resolveMaximumImportAgeYears } from "@/lib/import-age-policy"

export const UNIDENTIFIABLE_AUCTION_MAKES = ["Others", "Other", "Unknown", "Etc", "기타"]

export function buildPublicAuctionPolicy(now = new Date()) {
  const maxImportAgeYears = resolveMaximumImportAgeYears(undefined)
  const minimumImportYear = now.getFullYear() - maxImportAgeYears
  const earliestBoundaryMonth = `${minimumImportYear}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const publicFreshnessBoundary = new Date(now.getTime() - 36 * 60 * 60 * 1_000)
  /* Граница свежести — у всех площадок, а не только у Encar.

     Раньше лоты прочих площадок показывались, сколько бы их ни проверяли
     в последний раз. Замер 25.09.2026: все 189 лотов Carvago не
     проверялись 24–25 дней (площадка отвечает 403), а на сайте стояли как
     живые и составляли почти весь раздел «Европа». Норматив проверки у
     этих площадок — 12 часов; 72 часа — это шесть пропущенных циклов с
     запасом. Лоты не удаляются: после успешной перепроверки они
     возвращаются в каталог сами. */
  const otherSourcesFreshnessBoundary = new Date(now.getTime() - 72 * 60 * 60 * 1_000)

  const where: Prisma.AuctionListingWhereInput = {
    status: "ACTIVE",
    adminHiddenAt: null,
    OR: [{ auctionDate: null }, { auctionDate: { gte: now } }],
    year: { gte: minimumImportYear },
    AND: [
      { make: { notIn: UNIDENTIFIABLE_AUCTION_MAKES } },
      {
        OR: [
          { source: { not: "ENCAR" }, sourceLastSeenAt: { gte: otherSourcesFreshnessBoundary } },
          { source: "ENCAR", sourceLastSeenAt: { gte: publicFreshnessBoundary } },
        ],
      },
      {
        OR: [
          { year: { gt: minimumImportYear } },
          { year: minimumImportYear, manufacturedMonth: null },
          { year: minimumImportYear, manufacturedMonth: { gte: earliestBoundaryMonth } },
        ],
      },
    ],
  }

  return { where, maxImportAgeYears, minimumImportYear }
}
