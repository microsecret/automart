import Image from "next/image"
import type { ReactNode } from "react"

const PRODUCTS: Readonly<Record<string, string>> = {
  oil_filter: "filter", air_filter: "filter", cabin_filter: "filter", fuel_filter: "filter",
  spark_plugs: "sparkplug", belts: "belt",
  engine_oil: "oil", transmission_oil: "oil", brake_fluid: "oil", washer_fluid: "oil",
  hydraulic_fluid: "oil", greases: "oil", other_fluids: "oil",
}
const CATEGORIES: Readonly<Record<string, string>> = {
  battery: "electrical", brake_pads: "brakes", brake_discs: "brakes",
  shock_absorbers: "suspension", tires: "wheels", wheels: "wheels", bulbs: "lighting", antifreeze: "cooling",
}

/** Family imagery is decorative; the actual product group label stays visible. */
export default function ProductGroupArtwork({ group, fallback }: { group: string; fallback: ReactNode }) {
  const product = PRODUCTS[group]
  const category = CATEGORIES[group]
  const src = product ? `/images/ui/product-v1/${product}-192.webp`
    : category ? `/images/ui/category-v1/${category}-320.webp` : null
  return src ? <Image src={src} alt="" aria-hidden="true" width={64} height={64} unoptimized loading="lazy" draggable={false} style={{ objectFit: "contain" }} /> : fallback
}
