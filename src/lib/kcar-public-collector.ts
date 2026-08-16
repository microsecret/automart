import crypto from "node:crypto"
import type { AuctionConditionInfo, AuctionEquipmentSnapshot, AuctionImportItem } from "@/lib/auction-import"
import { normalizeAuctionBodyType, normalizeAuctionDriveType, normalizeAuctionFuelType, normalizeAuctionMake, normalizeAuctionTransmission } from "@/lib/auction-normalization"
import { authorizedSourceGet, authorizedSourceRequest } from "@/lib/authorized-source-http"

const KCAR_API_HOST = "api.kcar.com"
const KCAR_ALLOWED_HOSTS = new Set([KCAR_API_HOST])
const KCAR_API_BASE = `https://${KCAR_API_HOST}`
const KCAR_TIMEOUT_MS = 20_000
const KCAR_MAX_RESPONSE_BYTES = 5 * 1024 * 1024
const KCAR_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
  Origin: "https://www.kcar.com",
  Referer: "https://www.kcar.com/",
  "User-Agent": "LeWheel-Authorized-Importer/1.0 (+https://lewheel.ru)",
}
const KCAR_ACTIVE_STATUS = "CAR_STATUS010"
const KCAR_AES_KEY = Buffer.from("SKFJ2424DasfaJRI", "utf8")
const KCAR_AES_IV = Buffer.from("sfq241sf3dscs321", "utf8")
const KCAR_SEDAN_CATEGORIES = new Set(["경차", "소형차", "준중형차", "중형차", "대형차"])

type UnknownRecord = Record<string, unknown>

type KCarCatalogPage = {
  total: number
  page: number
  totalPages: number
  ids: string[]
}

export class KCarListingUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "KCarListingUnavailableError"
  }
}

export function isKCarListingUnavailableError(error: unknown): error is KCarListingUnavailableError {
  return error instanceof KCarListingUnavailableError
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function asInteger(value: unknown) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function htmlText(value: unknown) {
  return asText(value)
    ?.replace(/<br\s*\/?>/gi, "\n")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim() || null
}

function publicModelName(value: unknown) {
  const model = asText(value)
  if (!model) return null
  return model
    .replace(/^디 올 뉴\s+/, "The All-New ")
    .replace(/^올 뉴\s+/, "All-New ")
    .replace(/^더 뉴\s+/, "The New ")
    .replace(/^뉴\s+/, "New ")
    .replace(/하이브리드/g, "Hybrid")
    .replace(/그랜저/g, "Grandeur")
    .replace(/팰리세이드/g, "Palisade")
    .replace(/트래버스/g, "Traverse")
    .replace(/모닝/g, "Morning")
    .replace(/어반/g, "Urban")
    .replace(/쏘렌토/g, "Sorento")
    .replace(/싼타페/g, "Santa Fe")
    .replace(/카니발/g, "Carnival")
    .replace(/아반떼/g, "Avante")
    .replace(/쏘나타/g, "Sonata")
    .replace(/투싼/g, "Tucson")
    .replace(/스포티지/g, "Sportage")
}

function encryptCatalogParams(value: UnknownRecord) {
  const cleaned = Object.fromEntries(Object.entries(value).filter(([, entry]) => Boolean(entry)))
  const cipher = crypto.createCipheriv("aes-128-cbc", KCAR_AES_KEY, KCAR_AES_IV)
  return Buffer.concat([cipher.update(JSON.stringify(cleaned), "utf8"), cipher.final()]).toString("base64")
}

function catalogParams(page: number, limit: number) {
  return {
    wr_in_multi_columns: "cntr_rgn_cd|cntr_cd",
    pageno: page,
    limit,
    orderFlag: true,
    orderBy: "time_deal_yn:desc|time_deal_end_dt:asc|promo_ordr:asc|event_ordr:asc|sort_ordr:asc",
  }
}

async function parseJsonResponse(response: Awaited<ReturnType<typeof authorizedSourceGet>>) {
  const text = await response.text()
  if (!response.ok) throw new Error(`K Car API вернул HTTP ${response.status}`)
  try {
    return JSON.parse(text) as UnknownRecord
  } catch {
    throw new Error("K Car API вернул некорректный JSON")
  }
}

export async function discoverKCarListingIds(page = 1, limit = 20): Promise<KCarCatalogPage> {
  const safePage = Math.min(Math.max(Math.trunc(page), 1), 1_000)
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 30)
  const response = await authorizedSourceRequest(`${KCAR_API_BASE}/bc/search/list`, {
    allowedHosts: KCAR_ALLOWED_HOSTS,
    headers: { ...KCAR_HEADERS, "Content-Type": "application/json" },
    method: "POST",
    body: JSON.stringify({ enc: encryptCatalogParams(catalogParams(safePage, safeLimit)) }),
    timeoutMs: KCAR_TIMEOUT_MS,
    maxBytes: KCAR_MAX_RESPONSE_BYTES,
  })
  const payload = await parseJsonResponse(response)
  const data = asRecord(payload.data)
  const rows = Array.isArray(data?.rows) ? data.rows : []
  const ids = rows.flatMap((row) => {
    const id = asText(asRecord(row)?.carCd)
    return id && /^EC\d+$/.test(id) ? [id] : []
  })
  return {
    total: asInteger(data?.totalCnt) || ids.length,
    page: asInteger(data?.pageNo) || safePage,
    totalPages: asInteger(data?.totalPageCnt) || 1,
    ids: [...new Set(ids)],
  }
}

function equipmentSnapshot(payload: UnknownRecord): AuctionEquipmentSnapshot | null {
  const options = Array.isArray(payload.mainOptList) ? payload.mainOptList : []
  const items = options.flatMap((option) => {
    const record = asRecord(option)
    const label = asText(record?.optnNm) || asText(record?.optNm) || asText(record?.optDesc)
    return label ? [{ label, available: true }] : []
  }).slice(0, 100)
  return items.length ? { totalReported: items.length, items } : null
}

function conditionSnapshot(payload: UnknownRecord, vehicle: UnknownRecord): AuctionConditionInfo | null {
  const history = asRecord(payload.carhistory)
  const verifiedItems = [
    ["Статус площадки", asText(vehicle.statCdNm)],
    ["История ДТП", asText(vehicle.acdtHistComnt)],
    ["Диагностика", htmlText(vehicle.dgnosOpinCnts)],
  ].flatMap(([label, status]) => status ? [{ label: String(label), status: String(status).slice(0, 500) }] : []).slice(0, 20)
  const insuranceRecordCount = [history?.owncarDmgeAcdtCnt, history?.othrcarWrdgAcdtCnt]
    .map(asInteger)
    .filter((value): value is number => value !== null)
    .reduce((sum, value) => sum + value, 0)
  return verifiedItems.length || insuranceRecordCount
    ? { insuranceRecordCount, inspectionSummary: htmlText(vehicle.histCnts), newCarPriceRatioPct: null, verifiedItems }
    : null
}

function bodyTypeFrom(vehicle: UnknownRecord) {
  const category = asText(vehicle.carctgr)
  if (category && KCAR_SEDAN_CATEGORIES.has(category)) return "SEDAN"
  return normalizeAuctionBodyType(category)
}

export async function fetchKCarListing(sourceId: string): Promise<AuctionImportItem> {
  if (!/^EC\d+$/.test(sourceId)) throw new Error("Некорректный ID карточки K Car")
  const query = new URLSearchParams({ i_sCarCd: sourceId, i_sPassYn: "N", bltbdKnd: "CM050" })
  const response = await authorizedSourceGet(`${KCAR_API_BASE}/bc/car-info-detail-of-ng?${query}`, {
    allowedHosts: KCAR_ALLOWED_HOSTS,
    headers: KCAR_HEADERS,
    timeoutMs: KCAR_TIMEOUT_MS,
    maxBytes: KCAR_MAX_RESPONSE_BYTES,
  })
  if (response.status === 404 || response.status === 410) throw new KCarListingUnavailableError(`Карточка ${sourceId} снята с публикации`)
  const payload = await parseJsonResponse(response)
  const data = asRecord(payload.data)
  const vehicle = asRecord(data?.rvo)
  if (!vehicle) throw new KCarListingUnavailableError(`Карточка ${sourceId} отсутствует в каталоге K Car`)
  if (asText(vehicle.statCd) !== KCAR_ACTIVE_STATUS || asText(vehicle.delYn) === "Y") {
    throw new KCarListingUnavailableError(`Карточка ${sourceId} больше не продаётся на K Car`)
  }

  const confirmedId = asText(vehicle.carCd)
  const make = normalizeAuctionMake(vehicle.mnuftrNm)
  const model = publicModelName(vehicle.modelNm) || publicModelName(vehicle.modelGrpNm)
  const manufactured = asText(vehicle.mfgDt) || asText(vehicle.fstCarRegYm)
  const year = manufactured && /^\d{6}$/.test(manufactured) ? Number(manufactured.slice(0, 4)) : asInteger(vehicle.regModelyr)
  const priceTenThousandWon = asInteger(vehicle.salprc)
  if (confirmedId !== sourceId || !make || !model || !year || priceTenThousandWon === null) throw new Error(`K Car вернул неполную карточку ${sourceId}`)

  const photos = Array.isArray(data?.photoList) ? data.photoList : []
  const images = [...new Set(photos.flatMap((photo) => {
    const url = asText(asRecord(photo)?.elanPath)
    if (!url) return []
    try {
      const parsed = new URL(url)
      return parsed.protocol === "https:" && parsed.hostname === "img.kcar.com" ? [parsed.toString()] : []
    } catch {
      return []
    }
  }))].slice(0, 60)
  const fallbackImage = asText(vehicle.elanPath) || asText(vehicle.lsizeImgPath) || asText(vehicle.msizeImgPath)
  if (!images.length && fallbackImage?.startsWith("https://img.kcar.com/")) images.push(fallbackImage)

  const grade = [asText(vehicle.grdNm), asText(vehicle.grdDtlNm)].filter(Boolean).join(" ")
  return {
    source: "KCAR",
    sourceId,
    sourceUrl: `https://www.kcar.com/bc/detail/carInfoDtl?i_sCarCd=${encodeURIComponent(sourceId)}`,
    make,
    model,
    year,
    manufacturedMonth: manufactured && /^\d{6}$/.test(manufactured) ? `${manufactured.slice(0, 4)}-${manufactured.slice(4, 6)}` : null,
    sourcePrice: priceTenThousandWon * 10_000,
    sourceCurrency: "KRW",
    country: "KR",
    auctionDate: null,
    mileage: asInteger(vehicle.milg),
    fuelType: normalizeAuctionFuelType(vehicle.fuelTypecdNm),
    transmission: normalizeAuctionTransmission(vehicle.trnsmsncdNm),
    bodyType: bodyTypeFrom(vehicle),
    color: asText(vehicle.extrColorNm),
    engineVolume: asInteger(vehicle.engdispmnt),
    power: asInteger(vehicle.hrspow),
    driveType: normalizeAuctionDriveType(vehicle.drvgYnNm),
    vin: asText(vehicle.vin),
    lotNumber: asText(vehicle.cno),
    imageUrl: images[0] || null,
    images,
    descriptionOrig: htmlText(vehicle.simcDesc),
    specsOrig: grade || null,
    equipment: equipmentSnapshot(data || {}),
    conditionInfo: conditionSnapshot(data || {}, vehicle),
    location: asText(vehicle.centerRegionnm) || asText(vehicle.cntrNm),
  }
}
