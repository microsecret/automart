import Image from "next/image"
import type { ReactNode } from "react"

const SCENE_KEYS = new Set([
  "battery", "brake_pads", "brake_discs", "oil_filter", "air_filter",
  "cabin_filter", "fuel_filter", "spark_plugs", "shock_absorbers", "belts",
])

const PRODUCTS: Readonly<Record<string, string>> = {
  engine_oil: "oil", transmission_oil: "oil", brake_fluid: "oil", washer_fluid: "oil",
  hydraulic_fluid: "oil", greases: "oil", other_fluids: "oil",
  wiper_blades: "wiper", dashcams: "dashcam", car_mats: "mats", seat_covers: "seat-cover",
  chargers: "charger", compressors: "compressor", jacks: "jack", safety: "safety", roof_racks: "roof-rack",
  tools: "tools", tool_sets: "tools", autochem: "care",
  chem_engine: "care", chem_additives: "oil", chem_body: "care", chem_interior: "care", chem_repair: "care",
}
const CATEGORIES: Readonly<Record<string, string>> = {
  tires: "wheels", wheels: "wheels", bulbs: "lighting", antifreeze: "cooling",
}

export default function ProductGroupArtwork({ group, fallback }: { group: string; fallback: ReactNode }) {
  if (SCENE_KEYS.has(group)) {
    const scene = `/images/ui/product-scenes-v2/${group.replaceAll("_", "-")}`
    return (
      <picture className="parts-departments__photo">
        <source srcSet={`${scene}-384.webp 384w, ${scene}-640.webp 640w`} sizes="(max-width: 640px) 180px, 235px" />
        <Image src={`${scene}-384.webp`} alt="" width={384} height={240} unoptimized loading="lazy" decoding="async" draggable={false} />
      </picture>
    )
  }

  const product = PRODUCTS[group]
  const category = CATEGORIES[group]
  const src = product ? `/images/ui/product-v1/${product}-192.webp`
    : category ? `/images/ui/category-v1/${category}-320.webp` : null
  return src ? <Image src={src} alt="" width={192} height={128} unoptimized loading="lazy" decoding="async" draggable={false} className="parts-departments__cutout" /> : fallback
}
