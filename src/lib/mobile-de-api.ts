import type { AuctionConditionInfo, AuctionEquipmentSnapshot, AuctionImportItem } from "@/lib/auction-import"
import {
  normalizeAuctionBodyType,
  normalizeAuctionDriveType,
  normalizeAuctionFuelType,
  normalizeAuctionMake,
  normalizeAuctionTransmission,
} from "@/lib/auction-normalization"
import { authorizedSourceGet } from "@/lib/authorized-source-http"

const MOBILE_DE_API_HOST = "services.mobile.de"
const MOBILE_DE_ALLOWED_HOSTS = new Set([MOBILE_DE_API_HOST])
const MOBILE_DE_API_BASE = `https://${MOBILE_DE_API_HOST}`
const MOBILE_DE_TIMEOUT_MS = 20_000
const MOBILE_DE_MAX_RESPONSE_BYTES = 8 * 1024 * 1024
const MOBILE_DE_PAGE_SIZE_LIMIT = 100

type UnknownRecord = Record<string, unknown>

export type MobileDeCatalogPage = {
  total: number
  page: number
  totalPages: number
  ids: string[]
}

export class MobileDeListingUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MobileDeListingUnavailableError"
  }
}

export function isMobileDeListingUnavailableError(error: unknown): error is MobileDeListingUnavailableError {
  return error instanceof MobileDeListingUnavailableError
}

export function mobileDeApiConfigured() {
  return Boolean(process.env.MOBILE_DE_API_USERNAME?.trim() && process.env.MOBILE_DE_API_PASSWORD?.trim())
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null
}

function asText(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim()
  const record = asRecord(value)
  if (!record) return null
  return [record.description, record.name, record.label, record.id].find((entry) => typeof entry === "string" && entry.trim()) as string | undefined || null
}

function asInteger(value: unknown) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function parseSourceDate(value: unknown) {
  const text = asText(value)
  if (!text) return null
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function apiHeaders() {
  const username = process.env.MOBILE_DE_API_USERNAME?.trim()
  const password = process.env.MOBILE_DE_API_PASSWORD?.trim()
  if (!username || !password) throw new Error("Mobile.de Search API не настроен")
  return {
    Accept: "application/vnd.de.mobile.api+json",
    Authorization: `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`,
    "User-Agent": "LeWheel-Official-MobileDe-Importer/1.0 (+https://lewheel.ru)",
  }
}

async function parseJsonResponse(response: Awaited<ReturnType<typeof authorizedSourceGet>>) {
  if (response.status === 401 || response.status === 403) throw new Error("Mobile.de отклонил учётные данные Search API")
  const text = await response.text()
  if (!response.ok) throw new Error(`Mobile.de Search API вернул HTTP ${response.status}`)
  try {
    return JSON.parse(text) as UnknownRecord
  } catch {
    throw new Error("Mobile.de Search API вернул некорректный JSON")
  }
}

function sourceIdFrom(value: unknown) {
  const id = asText(value)
  return id && /^[A-Za-z0-9_-]{1,120}$/.test(id) ? id : null
}

export async function discoverMobileDeListingIds(options: { page?: number; pageSize?: number; minimumFirstRegistration?: string } = {}): Promise<MobileDeCatalogPage> {
  const page = Math.min(Math.max(Math.trunc(options.page || 1), 1), 20)
  const pageSize = Math.min(Math.max(Math.trunc(options.pageSize || 20), 1), MOBILE_DE_PAGE_SIZE_LIMIT)
  const query = new URLSearchParams({
    classification: "refdata/classes/Car",
    country: "DE",
    "page.number": String(page),
    "page.size": String(pageSize),
    "sort.field": "modificationTime",
    "sort.order": "DESCENDING",
  })
  if (options.minimumFirstRegistration && /^\d{4}-(0[1-9]|1[0-2])$/.test(options.minimumFirstRegistration)) {
    query.set("firstRegistrationDate.min", options.minimumFirstRegistration)
  }
  const response = await authorizedSourceGet(`${MOBILE_DE_API_BASE}/search-api/search?${query}`, {
    allowedHosts: MOBILE_DE_ALLOWED_HOSTS,
    headers: apiHeaders(),
    timeoutMs: MOBILE_DE_TIMEOUT_MS,
    maxBytes: MOBILE_DE_MAX_RESPONSE_BYTES,
  })
  const payload = await parseJsonResponse(response)
  const adsContainer = asRecord(payload.ads)
  const rows = Array.isArray(payload.ads) ? payload.ads : Array.isArray(adsContainer?.ad) ? adsContainer.ad : []
  const ids = rows.flatMap((row) => {
    const record = asRecord(row)
    const id = sourceIdFrom(record?.mobileAdId ?? record?.id)
    return id ? [id] : []
  })
  const total = asInteger(payload.total) ?? asInteger(payload.totalCount) ?? ids.length
  const currentPage = asInteger(payload.currentPage) ?? page
  const maxPages = Math.min(asInteger(payload.maxPages) ?? Math.max(1, Math.ceil(total / pageSize)), 20)
  return { total, page: currentPage, totalPages: maxPages, ids: [...new Set(ids)] }
}

function safeMobileUrl(value: unknown) {
  const url = asText(value)
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" && (parsed.hostname === "mobile.de" || parsed.hostname.endsWith(".mobile.de")) ? parsed.toString() : null
  } catch {
    return null
  }
}

function safeImageUrl(value: unknown) {
  const url = asText(value)
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.toString() : null
  } catch {
    return null
  }
}

function imageUrls(value: unknown) {
  const container = asRecord(value)
  const images = Array.isArray(value) ? value : Array.isArray(container?.image) ? container.image : Array.isArray(container?.images) ? container.images : []
  const variantPriority = ["xxxl", "xxl", "xl", "l", "m", "s", "url"]
  return [...new Set(images.flatMap((entry) => {
    if (typeof entry === "string") return safeImageUrl(entry) ? [safeImageUrl(entry)!] : []
    const record = asRecord(entry)
    if (!record) return []
    const url = variantPriority.map((key) => safeImageUrl(record[key])).find(Boolean)
    return url ? [url] : []
  }))].slice(0, 80)
}

function equipmentSnapshot(value: unknown): AuctionEquipmentSnapshot | null {
  const container = asRecord(value)
  const features = Array.isArray(value) ? value : Array.isArray(container?.feature) ? container.feature : Array.isArray(container?.features) ? container.features : []
  const labels = [...new Set(features.map(asText).filter((entry): entry is string => Boolean(entry)))].slice(0, 100)
  return labels.length ? { totalReported: labels.length, items: labels.map((label) => ({ label, available: true })) } : null
}

function conditionSnapshot(ad: UnknownRecord): AuctionConditionInfo | null {
  const checks: Array<{ label: string; status: string }> = []
  const condition = asText(ad.condition)
  if (condition) checks.push({ label: "Состояние у продавца", status: condition })
  if (typeof ad.damageUnrepaired === "boolean") checks.push({ label: "Неустранённые повреждения", status: ad.damageUnrepaired ? "Указаны продавцом" : "Не указаны продавцом" })
  if (typeof ad.accidentDamaged === "boolean") checks.push({ label: "Аварийный автомобиль", status: ad.accidentDamaged ? "Да" : "Нет" })
  return checks.length ? { insuranceRecordCount: null, inspectionSummary: null, newCarPriceRatioPct: null, verifiedItems: checks } : null
}

const BODY_TYPE_MAP: Record<string, string> = {
  Limousine: "SEDAN",
  OffRoad: "SUV",
  EstateCar: "WAGON",
  SmallCar: "HATCHBACK",
  SportsCar: "COUPE",
  Cabrio: "COUPE",
  Van: "MINIVAN",
  Bus: "MINIVAN",
  Pickup: "PICKUP",
}

function normalizedBodyType(value: unknown) {
  const source = asText(value)
  if (!source) return null
  return BODY_TYPE_MAP[source] || normalizeAuctionBodyType(source)
}

function inactiveListing(ad: UnknownRecord) {
  const state = asText(ad.adState ?? ad.status)?.toLocaleUpperCase("en-US")
  return Boolean(state && ["DELETED", "EXPIRED", "INACTIVE", "SOLD", "REMOVED"].includes(state))
}

export async function fetchMobileDeListing(sourceId: string): Promise<AuctionImportItem> {
  const safeId = sourceIdFrom(sourceId)
  if (!safeId) throw new Error("Некорректный ID карточки mobile.de")
  const response = await authorizedSourceGet(`${MOBILE_DE_API_BASE}/search-api/ad/${encodeURIComponent(safeId)}`, {
    allowedHosts: MOBILE_DE_ALLOWED_HOSTS,
    headers: apiHeaders(),
    timeoutMs: MOBILE_DE_TIMEOUT_MS,
    maxBytes: MOBILE_DE_MAX_RESPONSE_BYTES,
  })
  if (response.status === 404 || response.status === 410) throw new MobileDeListingUnavailableError(`Карточка ${safeId} снята с публикации`)
  const payload = await parseJsonResponse(response)
  const ad = asRecord(payload.ad) || payload
  if (inactiveListing(ad)) throw new MobileDeListingUnavailableError(`Карточка ${safeId} больше не активна на mobile.de`)

  const confirmedId = sourceIdFrom(ad.mobileAdId ?? ad.id)
  const make = normalizeAuctionMake(ad.make)
  const model = asText(ad.model) || asText(ad.modelDescription)
  const registration = asText(ad.firstRegistration)
  const year = registration && /^\d{6}$/.test(registration) ? Number(registration.slice(0, 4)) : asInteger(ad.year)
  const price = asRecord(ad.price)
  const grossPrice = asNumber(price?.consumerPriceGross ?? price?.consumerPrice ?? ad.price)
  const currency = asText(price?.currency)?.toLocaleUpperCase("en-US")
  const sourceUrl = safeMobileUrl(ad.detailPageUrl)
  if (confirmedId !== safeId || !make || !model || !year || grossPrice === null || !sourceUrl || currency !== "EUR") {
    throw new Error(`Mobile.de вернул неполную карточку ${safeId}`)
  }

  const images = imageUrls(ad.images)
  const seller = asRecord(ad.seller)
  const address = asRecord(seller?.address)
  const powerKw = asNumber(ad.power)
  const createdAt = parseSourceDate(ad.creationDate)
  return {
    source: "MOBILE_DE",
    sourceId: safeId,
    sourceUrl,
    make,
    model,
    year,
    manufacturedMonth: registration && /^\d{6}$/.test(registration) ? `${registration.slice(0, 4)}-${registration.slice(4, 6)}` : null,
    sourcePrice: Math.round(grossPrice),
    sourceCurrency: "EUR",
    country: "DE",
    auctionDate: createdAt,
    mileage: asInteger(ad.mileage),
    fuelType: normalizeAuctionFuelType(ad.fuel),
    transmission: normalizeAuctionTransmission(ad.gearbox),
    bodyType: normalizedBodyType(ad.category),
    color: asText(ad.exteriorColor) || asText(ad.color),
    engineVolume: asNumber(ad.cubicCapacity),
    power: powerKw === null ? null : Math.round(powerKw * 1.35962),
    driveType: normalizeAuctionDriveType(ad.driveType),
    vin: asText(ad.vin),
    lotNumber: null,
    imageUrl: images[0] || null,
    images,
    descriptionOrig: asText(ad.plainTextDescription) || asText(ad.description),
    specsOrig: [asText(ad.model), asText(ad.trimLine), asText(ad.vehicleClass)].filter(Boolean).join(" · ") || null,
    equipment: equipmentSnapshot(ad.features),
    conditionInfo: conditionSnapshot(ad),
    location: asText(address?.city),
  }
}
