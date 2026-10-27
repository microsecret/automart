import Image from "next/image"

const SOURCES: Readonly<Record<string, string>> = {
  car: "/images/ui/category-v1/cars-320.webp",
  moto: "/images/ui/category-v1/moto-320.webp",
  engine: "/images/ui/category-v1/parts-320.webp",
  brakes: "/images/ui/category-v1/brakes-320.webp",
  suspension: "/images/ui/category-v1/suspension-320.webp",
  electrical: "/images/ui/category-v1/electrical-320.webp",
  lighting: "/images/ui/category-v1/lighting-320.webp",
  transmission: "/images/ui/category-v1/transmission-320.webp",
  wheels: "/images/ui/category-v1/wheels-320.webp",
  cooling: "/images/ui/category-v1/cooling-320.webp",
  interior: "/images/ui/product-v1/seat-cover-192.webp",
  accessories: "/images/ui/product-v1/dashcam-192.webp",
  consumables: "/images/ui/product-v1/filter-192.webp",
  chemicals: "/images/ui/product-v1/care-192.webp",
  tools: "/images/ui/product-v1/tools-192.webp",
}

/** Decorative identity only: the caller owns the visible label and destination. */
export default function PartCategoryArtwork({ kind, compact = false }: { kind: string; compact?: boolean }) {
  const src = SOURCES[kind]
  if (!src) return null
  return <Image src={src} alt="" aria-hidden="true" width={compact ? 22 : 144} height={compact ? 22 : 104}
    unoptimized loading="lazy" decoding="async" draggable={false}
    className={compact ? "part-category-artwork part-category-artwork--compact" : "part-category-artwork"} />
}
