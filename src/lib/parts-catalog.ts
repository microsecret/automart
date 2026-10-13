import { ALL_BRANDS, type Brand, type CountryCode } from "@/lib/catalog"
import { PART_SUBCATEGORIES, PART_TYPES } from "@/lib/constants"
import { slugify } from "@/lib/news"

/**
 * Каталоги запчастей по автомобилям: регион → марка → модель → узел.
 *
 * Устройство повторяет привычные каталоги (parts-catalogs, acat), но
 * данные свои: дерево марок и моделей — из нашего справочника, узлы — наши
 * категории, а детали и номера приносят продавцы прайсами. Схемы и
 * нумерацию производителей не копируем: это лицензируемые базы.
 */

export type CatalogRegion = {
  slug: string
  label: string
  /** Прилагательное для заголовков: «Японские автомобили». */
  adjective: string
  countries: readonly CountryCode[]
}

export const CATALOG_REGIONS: readonly CatalogRegion[] = [
  { slug: "europe", label: "Европа", adjective: "Европейские", countries: ["DE", "FR", "GB", "CZ", "SE", "IT", "ES", "AT"] },
  { slug: "japan", label: "Япония", adjective: "Японские", countries: ["JP"] },
  { slug: "korea", label: "Корея", adjective: "Корейские", countries: ["KR"] },
  { slug: "china", label: "Китай", adjective: "Китайские", countries: ["CN"] },
  { slug: "usa", label: "США", adjective: "Американские", countries: ["US"] },
  { slug: "russia", label: "Россия", adjective: "Российские", countries: ["RU"] },
]

/* Каталог — для легковых: у мото, катеров и авиации другие узлы. */
const CAR_BRANDS: readonly Brand[] = ALL_BRANDS.filter((brand) => brand.category === "cars")

export function brandSlug(name: string) {
  return slugify(name) || "brand"
}

export function modelSlug(name: string) {
  return slugify(name) || "model"
}

export function regionOfBrand(brand: Brand): CatalogRegion | null {
  return CATALOG_REGIONS.find((region) => region.countries.includes(brand.country)) ?? null
}

export function catalogBrandsByRegion(region: CatalogRegion) {
  return CAR_BRANDS
    .filter((brand) => region.countries.includes(brand.country))
    .slice()
    .sort((a, b) => Number(b.popular) - Number(a.popular) || a.name.localeCompare(b.name, "ru"))
}

export function findCatalogBrand(slug: string): Brand | null {
  return CAR_BRANDS.find((brand) => brandSlug(brand.name) === slug.toLowerCase()) ?? null
}

export function findCatalogBrandByName(name: string): Brand | null {
  const key = name.trim().toLowerCase()
  return CAR_BRANDS.find((brand) => brand.name.toLowerCase() === key) ?? null
}

export function findCatalogModel(brand: Brand, slug: string): string | null {
  return brand.models.find((model) => modelSlug(model) === slug.toLowerCase()) ?? null
}

export function catalogHref(brand?: string | null, model?: string | null) {
  if (!brand) return "/catalogs"
  return model ? `/catalogs/${brandSlug(brand)}/${modelSlug(model)}` : `/catalogs/${brandSlug(brand)}`
}

/** Ссылка в подбор запчастей с машиной и узлом. */
export function catalogPartsHref(input: { make: string; model?: string | null; partType?: string | null; subcategory?: string | null }) {
  const params = new URLSearchParams({ make: input.make, compatible: "true" })
  if (input.model) params.set("model", input.model)
  if (input.partType) params.set("partType", input.partType)
  if (input.subcategory) params.set("subcategory", input.subcategory)
  return `/parts-finder?${params.toString()}`
}

/* Узлы на схеме автомобиля. Координаты — в системе схемы 800×340
   (вид сбоку, перед слева). Узлы без места на кузове (расходники,
   аксессуары) идут списком под схемой. */
export type CatalogUnit = {
  partType: string
  label: string
  subcategories: readonly string[]
  spot: { x: number; y: number } | null
}

const UNIT_SPOTS: Readonly<Record<string, { x: number; y: number }>> = {
  LIGHTING: { x: 92, y: 178 },
  COOLING: { x: 72, y: 214 },
  ENGINE: { x: 178, y: 160 },
  ELECTRICAL: { x: 250, y: 150 },
  STEERING: { x: 322, y: 140 },
  INTERIOR: { x: 430, y: 150 },
  BODY: { x: 470, y: 86 },
  TRANSMISSION: { x: 300, y: 238 },
  SUSPENSION: { x: 190, y: 204 },
  BRAKES: { x: 190, y: 252 },
  WHEELS: { x: 612, y: 252 },
  EXHAUST: { x: 716, y: 254 },
}

export const CATALOG_UNITS: readonly CatalogUnit[] = PART_TYPES
  .filter((type) => type.value !== "OTHER")
  .map((type) => ({
    partType: type.value,
    label: type.label,
    subcategories: PART_SUBCATEGORIES[type.value] ?? [],
    spot: UNIT_SPOTS[type.value] ?? null,
  }))
