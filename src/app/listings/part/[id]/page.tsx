import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { formatAttributeValue, PRODUCT_GROUP_BY_KEY } from "@/lib/product-groups"
import { DEFAULT_SOCIAL_IMAGE } from "@/lib/seo-metadata"
import { authOptions } from "@/lib/auth"
import { isListingModerator, LISTING_STATUS, publicListingWhere } from "@/lib/listing-lifecycle"
import PartDetailClient from "./PartDetailClient"
import { parseImages } from "@/lib/format"
import { serializeJsonLd } from "@/lib/json-ld"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  /* Товар работающего магазина объявления не имеет, а заголовок искал
     только объявление: страница открывалась, но называлась «Запчасть не
     найдена» и закрывалась от поисковиков. */
  const part = await prisma.part.findFirst({
    where: { id, OR: [{ listings: { some: publicListingWhere } }, { store: { status: "ACTIVE" } }] },
    select: { name: true, make: true, model: true, price: true, images: true, location: true },
  })
  if (!part) return { title: "Запчасть не найдена", robots: { index: false, follow: false } }
  /* Универсальная позиция магазина хранит марку «Универсальная» и модель
     «—»: в заголовке выходило «…для Универсальная —». */
  const forVehicle = part.make && part.make !== "Универсальная" && part.make !== "Universal" ? ` для ${part.make}${part.model && part.model !== "—" ? ` ${part.model}` : ""}` : ""
  const title = `${part.name}${forVehicle}`
  const description = `${part.name}${forVehicle} в ${part.location}, цена ${part.price.toLocaleString("ru-RU")} ₽. Совместимость и фотографии.`
  const canonical = `/listings/part/${id}`
  const images = parseImages(part.images)
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "website", title, description, url: canonical, images: images.length ? [{ url: images[0], alt: title }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: [images[0] ?? DEFAULT_SOCIAL_IMAGE] },
  }
}

export default async function PartDetailPage({ params }: PageProps) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  const part = await prisma.part.findUnique({
    where: { id },
    include: {
      compatibility: {
        select: { id: true, make: true, model: true, generation: true, yearFrom: true, yearTo: true, engine: true },
        orderBy: { make: "asc" },
      },
      /* Магазин, если позиция пришла из его прайса.

         Товары магазинов создаются импортом и объявления не получают —
         только запись позиции. Поиск их показывает, а страница детали
         требовала объявление и отвечала «не найдено»: покупатель
         находил деталь в каталоге, нажимал на неё и упирался в пустую
         страницу. Заказать можно было только с витрины магазина, куда
         ещё надо догадаться зайти. */
      store: { select: { id: true, slug: true, name: true, status: true, legalName: true, inn: true, ogrn: true, legalAddress: true, contactPhone: true, sellerType: true } },
      attributes: { select: { key: true, num: true, text: true } },
      user: {
        select: {
          id: true, name: true, image: true, createdAt: true,
          parts: { where: { listings: { some: publicListingWhere } }, select: { id: true, name: true, price: true }, take: 4 },
        },
      },
      listings: {
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: {
          reviews: {
            include: { user: { select: { id: true, name: true, image: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      bids: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      },
    },
  })

  if (!part) notFound()

  const listing = part.listings[0]
  const canPreview = Boolean(
    listing && (
      listing.status === LISTING_STATUS.ACTIVE ||
      listing.userId === session?.user?.id ||
      isListingModerator(session?.user?.role)
    ),
  )

  /* Позиция работающего магазина открывается и без объявления.

     Всё, что нужно странице, лежит в самой позиции — название, цена,
     совместимость, снимки; объявление давало только идентификатор для
     отзывов и ставок, а у магазинного товара их и не бывает.

     Приостановленный или черновой магазин по-прежнему закрыт: его
     товары не показываются и в поиске. */
  const fromActiveStore = part.store?.status === "ACTIVE"
  if (!fromActiveStore && (!listing || !canPreview)) notFound()

  const data = {
    id: part.id,
    name: part.name,
    description: part.description,
    price: part.price,
    condition: part.condition,
    availability: part.availability || "IN_STOCK",
    make: part.make,
    model: part.model,
    yearFrom: part.yearFrom,
    yearTo: part.yearTo,
    partType: part.partType,
    subcategory: part.subcategory,
    oemNumber: part.oemNumber,
    /* Характеристики в порядке справочника группы, с единицами:
       «Ёмкость — 62 Ач», «Полярность — обратная». */
    productGroupLabel: part.productGroup ? PRODUCT_GROUP_BY_KEY.get(part.productGroup)?.label ?? null : null,
    brandName: part.brandName,
    /* Сведения, которые покупатель обязан видеть до покупки (ЗоЗПП ст. 9,
       10, 26.1): документы, гарантия, продавец. */
    legal: {
      brandName: part.brandName, manufacturerInfo: part.manufacturerInfo, originCountry: part.originCountry,
      warrantyMonths: part.warrantyMonths, shelfLife: part.shelfLife, safetyInfo: part.safetyInfo, gtin: part.gtin,
      conformityType: part.conformityType, conformityRegulation: part.conformityRegulation, conformityNumber: part.conformityNumber,
      conformityValidUntil: part.conformityValidUntil ? part.conformityValidUntil.toISOString() : null,
      conformityUrl: part.conformityUrl, condition: part.condition,
    },
    storeSeller: part.store?.status === "ACTIVE" ? {
      name: part.store.name, legalName: part.store.legalName, inn: part.store.inn, ogrn: part.store.ogrn,
      legalAddress: part.store.legalAddress, contactPhone: part.store.contactPhone, sellerType: part.store.sellerType,
      /* Опубликованный магазин прошёл проверку реквизитов администратором. */
      verified: true,
    } : null,
    specs: (() => {
      const group = part.productGroup ? PRODUCT_GROUP_BY_KEY.get(part.productGroup) : null
      if (!group) return []
      return group.attributes.flatMap((def) => {
        const value = part.attributes.find((item) => item.key === def.key)
        return value ? [{ label: def.label, value: formatAttributeValue(def, value) }] : []
      })
    })(),
    suspensionType: part.suspensionType,
    brakeType: part.brakeType,
    compatibility: part.compatibility || [],
    location: part.location,
    images: part.images,
    createdAt: part.createdAt,
    saleFormat: part.saleFormat,
    auctionStatus: part.auctionStatus,
    auctionEndsAt: part.auctionEndsAt,
    auctionCurrentPrice: part.auctionCurrentPrice,
    auctionMinStep: part.auctionMinStep,
    bids: part.bids,
    /* Магазин и условия поставки: по ним на странице появляется кнопка
       заказа. Без них покупатель открывал деталь и не мог её заказать —
       заказ жил только на витрине магазина. */
    store: part.store?.status === "ACTIVE" && part.store.slug
      ? { slug: part.store.slug, name: part.store.name }
      : null,
    supplyMode: part.supplyMode,
    leadTimeDaysMin: part.leadTimeDaysMin,
    leadTimeDaysMax: part.leadTimeDaysMax,
    listingId: listing?.id,
    views: listing?.views || 0,
    seller: {
      id: part.user.id,
      name: part.user.name,
      image: part.user.image,
      memberSince: part.user.createdAt,
      otherParts: part.user.parts.filter((p) => p.id !== part.id).slice(0, 4),
    },
    reviews: listing?.reviews || [],
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": part.name,
    "description": part.description || `${part.name} для ${part.make} ${part.model}`,
    "brand": { "@type": "Brand", "name": part.make },
    "category": part.partType,
    "sku": part.oemNumber || undefined,
    "offers": {
      "@type": "Offer",
      "price": part.price,
      "priceCurrency": "RUB",
      "itemCondition": part.condition === "NEW" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <PartDetailClient data={data} />
    </>
  )
}
