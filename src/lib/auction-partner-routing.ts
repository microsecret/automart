import { prisma } from "@/lib/prisma"
import { SLA_NEUTRAL_RATING, SLA_RESPONSE_TARGET_MINUTES } from "@/lib/partner-sla"

const OFFER_LIMIT = 3
const OFFER_TTL_MS = 24 * 60 * 60 * 1000
const COUNTRY_TERMS: Record<string, string[]> = {
  CN: ["китай", "china", "кнр"],
  KR: ["корея", "korea"],
  JP: ["япония", "japan"],
  US: ["сша", "usa", "america"],
  DE: ["европа", "германия", "europe", "germany"],
}

function normalizeRegion(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim()
}

export function readServiceRegions(value: string | null) {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string").map(normalizeRegion).filter(Boolean)
  } catch {
    // Older partner applications stored a free-form comma-separated value.
  }
  return value.split(/[,;\n]+/u).map(normalizeRegion).filter(Boolean)
}

export function scoreAuctionPartner(input: {
  destinationCity: string | null
  sourceCountry: string
  serviceRegions: string | null
  activeAssignments: number
  openOffers: number
  slaRating?: number | null
  slaResponseMinutes?: number | null
}) {
  const regions = readServiceRegions(input.serviceRegions)
  const joined = regions.join(" ")
  const city = normalizeRegion(input.destinationCity || "")
  const cityTokens = city.split(" ").filter((token) => token.length >= 4)
  const exactCity = Boolean(city && regions.some((region) => region === city || region.includes(city)))
  const partialCity = !exactCity && cityTokens.some((token) => joined.includes(token))
  const countryMatch = (COUNTRY_TERMS[input.sourceCountry] || []).some((term) => joined.includes(term))
  // Регион и загрузка говорят о доступности, но не о том, отработает ли
  // партнёр заявку. Рейтинг смещает выбор к тем, кто отвечает и доводит
  // сделку: вклад ограничен, чтобы близкий партнёр не проигрывал далёкому.
  const rating = typeof input.slaRating === "number" ? input.slaRating : SLA_NEUTRAL_RATING
  const slaBonus = Math.round(((rating - SLA_NEUTRAL_RATING) / 100) * 60)
  const score = 20
    + (exactCity ? 120 : partialCity ? 60 : 0)
    + (countryMatch ? 30 : 0)
    - Math.min(45, input.activeAssignments * 6 + input.openOffers * 3)
    + slaBonus
  const fastResponder = typeof input.slaResponseMinutes === "number" && input.slaResponseMinutes <= SLA_RESPONSE_TARGET_MINUTES
  const reasons = [
    exactCity ? "работает в городе доставки" : partialCity ? "работает в указанном регионе" : null,
    countryMatch ? "работает с выбранной страной" : null,
    !input.activeAssignments ? "свободен от активных заявок" : null,
    fastResponder ? "отвечает в течение часа" : null,
  ].filter((reason): reason is string => Boolean(reason))

  return { score, reason: reasons.join(" · ") || "проверенный партнёр с наименьшей нагрузкой" }
}

export async function routeAuctionInquiryToPartners(inquiryId: string) {
  const inquiry = await prisma.auctionInquiry.findUnique({
    where: { id: inquiryId },
    select: {
      id: true,
      city: true,
      assignedPartnerId: true,
      auctionListing: { select: { make: true, model: true, year: true, country: true } },
    },
  })
  if (!inquiry || inquiry.assignedPartnerId) return { offered: 0 }

  const organizations = await prisma.deliveryOrganization.findMany({
    where: { verificationStatus: "VERIFIED" },
    select: {
      id: true,
      legalName: true,
      ownerId: true,
      serviceRegions: true,
      slaRating: true,
      slaResponseMinutes: true,
      owner: {
        select: {
          _count: {
            select: {
              assignedAuctionInquiries: { where: { status: { in: ["CONTACTED", "IN_PROGRESS"] } } },
              auctionInquiryOffers: { where: { status: "OFFERED", expiresAt: { gt: new Date() } } },
            },
          },
        },
      },
    },
  })
  if (!organizations.length) return { offered: 0 }

  const ranked = organizations
    .map((organization) => ({
      ...organization,
      ...scoreAuctionPartner({
        destinationCity: inquiry.city,
        sourceCountry: inquiry.auctionListing.country,
        serviceRegions: organization.serviceRegions,
        activeAssignments: organization.owner._count.assignedAuctionInquiries,
        openOffers: organization.owner._count.auctionInquiryOffers,
        slaRating: organization.slaRating,
        slaResponseMinutes: organization.slaResponseMinutes,
      }),
    }))
    .sort((first, second) => second.score - first.score || first.legalName.localeCompare(second.legalName, "ru"))
    .slice(0, OFFER_LIMIT)

  const expiresAt = new Date(Date.now() + OFFER_TTL_MS)
  await prisma.$transaction([
    prisma.auctionInquiryOffer.createMany({
      data: ranked.map((partner) => ({
        inquiryId: inquiry.id,
        partnerId: partner.ownerId,
        organizationId: partner.id,
        matchScore: partner.score,
        matchReason: partner.reason,
        expiresAt,
      })),
    }),
    prisma.notification.createMany({
      data: ranked.map((partner) => ({
        userId: partner.ownerId,
        title: "Новая заявка рядом",
        content: [
          inquiry.auctionListing.make,
          inquiry.auctionListing.model,
          inquiry.auctionListing.year,
          "·",
          inquiry.city || "город уточняется",
        ].join(" "),
        type: "INFO",
        relatedId: inquiry.id,
        relatedType: "AUCTION_INQUIRY_OFFER",
      })),
    }),
  ])

  return { offered: ranked.length }
}
