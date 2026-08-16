import type { Metadata } from "next"
import { cache } from "react"
import { prisma } from "@/lib/prisma"
import { buildPublicAuctionPolicy } from "@/lib/auction-public-catalog"
import { auctionSourceLabel } from "@/lib/auction-sources"
import { isSafeMediaUrl, parseAuctionImages } from "@/lib/media-url"
import { auctionVehicleIdentity } from "@/lib/auction-normalization"
import StructuredData from "@/components/seo/StructuredData"
import { absoluteUrl, getSiteUrl } from "@/lib/site-url"
import { formatPriceShort } from "@/lib/format"
import BrandIcon from "@/components/brands/BrandIcon"
import styles from "./auction-layout.module.css"

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

const getPublicAuctionListing = cache(async (id: string) => {
  const policy = buildPublicAuctionPolicy()
  return prisma.auctionListing.findFirst({
    where: { id, ...policy.where },
    select: {
      id: true,
      make: true,
      model: true,
      year: true,
      manufacturedMonth: true,
      mileage: true,
      priceRub: true,
      finalPrice: true,
      sourcePrice: true,
      sourceCurrency: true,
      conditionInfo: true,
      source: true,
      sourceId: true,
      sourceUrl: true,
      lotNumber: true,
      imageUrl: true,
      images: true,
      engineVolume: true,
      power: true,
      fuelType: true,
      transmission: true,
      bodyType: true,
      color: true,
      location: true,
      country: true,
      vin: true,
    },
  })
})

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { id } = await params
  const listing = await getPublicAuctionListing(id)

  if (!listing) {
    return { title: "Лот недоступен", robots: { index: false, follow: false } }
  }

  const identity = auctionVehicleIdentity(listing.make, listing.model)
  const title = `${identity.title} ${listing.year} — ${auctionSourceLabel(listing.source)}`
  const mileage = listing.mileage === null ? "пробег не опубликован" : `${listing.mileage.toLocaleString("ru-RU")} км`
  const isRentalTransfer = (() => {
    if (!listing.conditionInfo) return false
    try {
      const parsed = JSON.parse(listing.conditionInfo) as { verifiedItems?: unknown }
      return Array.isArray(parsed.verifiedItems) && parsed.verifiedItems.some((item) => {
        if (!item || typeof item !== "object") return false
        const record = item as { label?: unknown; status?: unknown }
        return record.label === "Тип предложения" && typeof record.status === "string" && /аренд/i.test(record.status)
      })
    } catch {
      return false
    }
  })()
  const description = isRentalTransfer
    ? `${title}, ${mileage}. Расчётный остаток регулярных платежей ${listing.priceRub.toLocaleString("ru-RU")} ₽ — не цена продажи автомобиля; условия выкупа и экспорта требуют подтверждения.`
    : `${title}, ${mileage}. Предварительная стоимость под ключ ${listing.finalPrice.toLocaleString("ru-RU")} ₽, фотографии и расчёт доставки в Россию.`
  const canonical = `/auctions/${id}`
  const image = isSafeMediaUrl(listing.imageUrl) ? listing.imageUrl : parseAuctionImages(listing.images)?.[0]

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "website", title, description, url: canonical, images: image ? [{ url: image, alt: title }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  }
}

export default async function AuctionDetailLayout({ children, params }: LayoutProps) {
  const { id } = await params
  const listing = await getPublicAuctionListing(id)
  if (!listing) return children

  const identity = auctionVehicleIdentity(listing.make, listing.model)
  const canonical = absoluteUrl(`/auctions/${listing.id}`)
  const image = isSafeMediaUrl(listing.imageUrl) ? listing.imageUrl : parseAuctionImages(listing.images)?.[0]
  const countryNames: Record<string, string> = { JP: "Япония", KR: "Республика Корея", CN: "Китай", US: "США", DE: "Германия", EU: "Европа", AE: "ОАЭ" }
  const additionalProperty = [
    listing.power ? { "@type": "PropertyValue", name: "Мощность", value: `${listing.power} л.с.` } : null,
    listing.engineVolume ? { "@type": "PropertyValue", name: "Объём двигателя", value: `${Math.round(listing.engineVolume)} см³` } : null,
    listing.location ? { "@type": "PropertyValue", name: "Местонахождение", value: listing.location } : null,
    listing.sourcePrice > 0 ? { "@type": "PropertyValue", name: "Цена источника", value: `${listing.sourcePrice.toLocaleString("ru-RU")} ${listing.sourceCurrency}` } : null,
    { "@type": "PropertyValue", name: "Страна площадки", value: countryNames[listing.country] || listing.country },
    { "@type": "PropertyValue", name: "Источник", value: auctionSourceLabel(listing.source) },
  ].filter(Boolean)

  return (
    <>
      <StructuredData data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": ["Product", "Vehicle"],
            "@id": `${canonical}#vehicle`,
            url: canonical,
            sameAs: listing.sourceUrl,
            name: `${identity.title} ${listing.year}`,
            description: `${identity.title}, ${listing.year} год. Предложение ${auctionSourceLabel(listing.source)} с расчётом стоимости доставки в Россию.`,
            sku: listing.lotNumber || `${listing.source}-${listing.sourceId}`,
            image: image ? [image] : undefined,
            brand: { "@type": "Brand", name: identity.make },
            model: identity.model,
            vehicleModelDate: String(listing.year),
            productionDate: listing.manufacturedMonth || String(listing.year),
            mileageFromOdometer: listing.mileage == null ? undefined : { "@type": "QuantitativeValue", value: listing.mileage, unitCode: "KMT" },
            vehicleTransmission: listing.transmission || undefined,
            fuelType: listing.fuelType || undefined,
            bodyType: listing.bodyType || undefined,
            color: listing.color || undefined,
            vehicleIdentificationNumber: listing.vin || undefined,
            additionalProperty,
            offers: {
              "@type": "Offer",
              url: canonical,
              priceCurrency: "RUB",
              price: listing.finalPrice,
              availability: "https://schema.org/InStock",
              availableAtOrFrom: listing.location ? {
                "@type": "Place",
                name: listing.location,
                address: { "@type": "PostalAddress", addressCountry: countryNames[listing.country] || listing.country },
              } : undefined,
              seller: { "@id": `${getSiteUrl()}/#organization` },
            },
          },
          {
            "@type": "BreadcrumbList",
            "@id": `${canonical}#breadcrumbs`,
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Главная", item: absoluteUrl("/") },
              { "@type": "ListItem", position: 2, name: "Авто из-за рубежа", item: absoluteUrl("/auctions") },
              { "@type": "ListItem", position: 3, name: identity.title, item: canonical },
            ],
          },
        ],
      }} />
      <header className={styles.heading}>
        <div className={styles.identity}>
          <BrandIcon brand={identity.make} size={46} />
          <div>
            <h1 className={styles.title}>{identity.title}</h1>
            <p className={styles.subtitle}>{listing.year} год · {auctionSourceLabel(listing.source)} · обновлено из первоисточника</p>
          </div>
        </div>
        <strong className={styles.price}>{formatPriceShort(listing.finalPrice)}</strong>
      </header>
      {children}
    </>
  )
}
