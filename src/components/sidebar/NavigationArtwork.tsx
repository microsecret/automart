import Image from "next/image"

const assets: Readonly<Record<string, string>> = {
  cars: "category-v1/cars-320", moto: "category-v1/moto-320", trucks: "category-v1/trucks-320",
  special: "category-v1/special-320", water: "category-v1/water-320", air: "category-v1/air-320",
  dashboard: "navigation-v1/dashboard-96", wallet: "navigation-v1/wallet-96",
  settings: "navigation-v1/settings-96", bell: "navigation-v1/bell-96", orders: "navigation-v1/orders-96",
  store: "navigation-v1/store-96", support: "navigation-v1/support-96",
  auctions: "titanium-v1/auctions-320", fuel: "titanium-v1/fuel-map-320",
  history: "titanium-v1/history-check-320", valuation: "titanium-v1/valuation-320",
  matching: "titanium-v1/matching-320", safety: "titanium-v1/safe-deal-320",
  documents: "titanium-v1/documents-320", garage: "titanium-v1/garage-320",
  publish: "titanium-v1/publish-listing-320", deliveries: "titanium-v1/deliveries-320",
  messages: "titanium-v1/messages-320", favorites: "titanium-v1/favorites-320",
  partner: "titanium-v1/partner-320", parts: "category-v1/parts-320",
}

/** The link text provides the accessible name; artwork never replaces it. */
export default function NavigationArtwork({ kind }: { kind: string }) {
  const asset = assets[kind]
  if (!asset) return null
  return <Image src={`/images/ui/${asset}.webp`} width={22} height={22} alt="" aria-hidden="true"
    unoptimized loading="lazy" decoding="async" draggable={false} className="lw-navigation-artwork" />
}
