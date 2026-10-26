/**
 * Объёмные значки мини-приложения.
 *
 * Те же титановые значки, что в боковой колонке и витрине сайта:
 * мини-приложение — часть LeWheel, а не отдельная поделка со своими
 * контурными иконками. Значок только украшает — подпись рядом всегда
 * остаётся настоящим текстом и даёт ссылке имя.
 */

const ART: Readonly<Record<string, string>> = {
  /* Разделы и вкладки */
  vehicles: "category-v1/cars-320",
  fuel: "titanium-v1/fuel-map-320",
  "fuel-map": "titanium-v1/fuel-map-320",
  auctions: "titanium-v1/auctions-320",
  news: "titanium-v1/documents-320",
  chats: "titanium-v1/messages-320",
  messages: "titanium-v1/messages-320",
  forum: "titanium-v1/messages-320",
  parts: "category-v1/parts-320",
  favorites: "titanium-v1/favorites-320",
  notifications: "navigation-v1/bell-96",
  listings: "titanium-v1/publish-listing-320",
  garage: "titanium-v1/garage-320",
  "part-requests": "navigation-v1/orders-96",
  deliveries: "titanium-v1/deliveries-320",
  documents: "titanium-v1/documents-320",
  /* Сервисы */
  "history-check": "titanium-v1/history-check-320",
  valuation: "titanium-v1/valuation-320",
  "smart-matching": "titanium-v1/matching-320",
  "safe-deal": "titanium-v1/safe-deal-320",
  "legal-documents": "titanium-v1/documents-320",
  support: "navigation-v1/support-96",
  dashboard: "navigation-v1/dashboard-96",
  publish: "titanium-v1/publish-listing-320",
  /* Типы техники */
  all: "navigation-v1/dashboard-96",
  cars: "category-v1/cars-320",
  moto: "category-v1/moto-320",
  trucks: "category-v1/trucks-320",
  special: "category-v1/special-320",
  water: "category-v1/water-320",
  air: "category-v1/air-320",
}

export function hasMiniArt(kind: string): boolean {
  return kind in ART
}

/** Декоративный объёмный значок. Имя ссылке даёт подпись рядом, не он. */
export default function MiniArt({ kind, size = 28, className = "" }: { kind: string; size?: number; className?: string }) {
  const asset = ART[kind]
  if (!asset) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element -- готовые webp, оптимизатор не нужен
    <img
      src={`/images/ui/${asset}.webp`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`tg-art ${className}`.trim()}
    />
  )
}
