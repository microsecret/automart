import type { AuctionImportItem } from "@/lib/auction-import"
import {
  normalizeAuctionBodyType,
  normalizeAuctionDriveType,
  normalizeAuctionFuelType,
  normalizeAuctionMake,
  normalizeAuctionModel,
  normalizeAuctionTransmission,
} from "@/lib/auction-normalization"
import { authorizedSourceGet } from "@/lib/authorized-source-http"
import { translateToRussian } from "@/lib/nvidia-translate"

export const PUBLIC_AUCTION_SOURCES = ["IAUTOS", "GOONET", "CARVAGO"] as const
export type PublicAuctionSource = (typeof PUBLIC_AUCTION_SOURCES)[number]

export type PublicAuctionCandidate = {
  sourceId: string
  sourceUrl: string
  sourcePrice?: number
  year?: number
  manufacturedMonth?: string | null
  mileage?: number | null
  imageUrl?: string | null
}

type UnknownRecord = Record<string, unknown>

const SOURCE_TIMEOUT_MS = 25_000
const SOURCE_MAX_BYTES = 4 * 1024 * 1024
const SOURCE_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.8",
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
}
const SOURCE_HOSTS: Record<PublicAuctionSource, ReadonlySet<string>> = {
  IAUTOS: new Set(["so.iautos.cn", "www.iautos.cn"]),
  GOONET: new Set(["www.goo-net-exchange.com"]),
  CARVAGO: new Set(["carvago.com", "www.carvago.com"]),
}

const CHINESE_MAKES: ReadonlyArray<readonly [string, string]> = [
  ["梅赛德斯-奔驰", "Mercedes-Benz"], ["雷克萨斯", "Lexus"], ["凯迪拉克", "Cadillac"],
  ["阿尔法·罗密欧", "Alfa Romeo"], ["广汽传祺", "GAC"], ["一汽-大众", "Volkswagen"],
  ["上汽大众", "Volkswagen"], ["东风日产", "Nissan"], ["长安福特", "Ford"],
  ["北京现代", "Hyundai"], ["华晨宝马", "BMW"], ["奥迪", "Audi"], ["宝马", "BMW"],
  ["奔驰", "Mercedes-Benz"], ["大众", "Volkswagen"], ["丰田", "Toyota"], ["本田", "Honda"],
  ["日产", "Nissan"], ["特斯拉", "Tesla"], ["保时捷", "Porsche"], ["沃尔沃", "Volvo"],
  ["路虎", "Land Rover"], ["别克", "Buick"], ["雪佛兰", "Chevrolet"], ["福特", "Ford"],
  ["现代", "Hyundai"], ["起亚", "Kia"], ["马自达", "Mazda"], ["斯柯达", "Skoda"],
  ["林肯", "Lincoln"], ["吉利", "Geely"], ["比亚迪", "BYD"], ["奇瑞", "Chery"],
  ["长城", "Great Wall"], ["红旗", "Hongqi"], ["理想", "Li Auto"], ["蔚来", "Nio"],
  ["小鹏", "Xpeng"], ["极氪", "Zeekr"], ["五菱", "Wuling"], ["荣威", "Roewe"],
]

const CHINESE_MODEL_TERMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(\d{4})款/g, "$1"], [/([A-Z])级/gi, "$1-Class"], [/(\d+)系/g, "$1 Series"],
  [/自动/g, "АКПП"], [/手动/g, "МКПП"], [/前驱/g, "передний привод"], [/后驱/g, "задний привод"],
  [/四驱|全驱/g, "полный привод"], [/运动版/g, "Sport"], [/时尚版/g, "Style"],
  [/豪华版/g, "Luxury"], [/尊贵版/g, "Premium"], [/旗舰版/g, "Flagship"], [/标准版/g, "Standard"],
  [/舒适版/g, "Comfort"], [/卓越版/g, "Excellence"], [/臻享版/g, "Premium"],
  [/\(国Ⅵ\)|\(国VI\)/gi, "экостандарт China VI"], [/\(国Ⅴ\)|\(国V\)/gi, "экостандарт China V"],
]

export class PublicListingUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PublicListingUnavailableError"
  }
}

export function isPublicListingUnavailableError(error: unknown): error is PublicListingUnavailableError {
  return error instanceof PublicListingUnavailableError
}

export function isPublicAuctionSource(value: string): value is PublicAuctionSource {
  return PUBLIC_AUCTION_SOURCES.includes(value as PublicAuctionSource)
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function asNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
}

function htmlText(value: string | null | undefined) {
  if (!value) return null
  return decodeHtml(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim() || null
}

function firstMatch(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1]?.trim() || null
}

function safeImage(value: string | null, allowedHosts: ReadonlySet<string>) {
  if (!value) return null
  try {
    const url = new URL(decodeHtml(value))
    return url.protocol === "https:" && allowedHosts.has(url.hostname) ? url.toString() : null
  } catch {
    return null
  }
}

function localizeChineseModel(value: string) {
  return CHINESE_MODEL_TERMS.reduce((model, [pattern, replacement]) => model.replace(pattern, replacement), value)
    .replace(/\s+/g, " ")
    .trim()
}

async function sourceHtml(source: PublicAuctionSource, url: string) {
  const response = await authorizedSourceGet(url, {
    allowedHosts: SOURCE_HOSTS[source], headers: SOURCE_HEADERS,
    timeoutMs: SOURCE_TIMEOUT_MS, maxBytes: SOURCE_MAX_BYTES,
  })
  if (response.status === 404 || response.status === 410) throw new PublicListingUnavailableError(`Карточка ${source} снята с публикации`)
  if (!response.ok) throw new Error(`${source} вернул HTTP ${response.status}`)
  return response.text()
}

export function publicSourceCatalogUrl(source: PublicAuctionSource, page: number) {
  if (source === "IAUTOS") return page <= 1 ? "https://so.iautos.cn/quanguo/" : `https://so.iautos.cn/quanguo/p${page}asdsvepcatcpbnscac/#buyCars`
  if (source === "GOONET") return "https://www.goo-net-exchange.com/php/search/summary.php?year_min=2021&search_type=year_search"
  return "https://carvago.com/sitemap-listed-cars.xml"
}

export function publicSourceMaximumPage(source: PublicAuctionSource) {
  return source === "IAUTOS" ? 50 : source === "GOONET" ? 20 : 200
}

function parseIautosCatalog(html: string): PublicAuctionCandidate[] {
  const candidates: PublicAuctionCandidate[] = []
  for (const match of html.matchAll(/<li\s+data-id="(\d+)"[^>]*>([\s\S]*?)<\/li>/gi)) {
    const sourceId = match[1]
    const block = match[2]
    const sourceUrl = firstMatch(block, /href="(https:\/\/www\.iautos\.cn\/usedcar-\d+\.html)"/i)
    const date = firstMatch(block, /<div class="parameter">[\s\S]*?<span>\s*(\d{4})年(\d{2})月\s*<\/span>/i)
    const month = block.match(/<div class="parameter">[\s\S]*?<span>\s*\d{4}年(\d{2})月\s*<\/span>/i)?.[1]
    const mileageWan = asNumber(firstMatch(block, /<div class="parameter">[\s\S]*?<span>\s*([\d.]+)万公里/i))
    const priceWan = asNumber(firstMatch(block, /<strong class="num">\s*([\d.]+)\s*<\/strong>/i))
    const imageUrl = safeImage(firstMatch(block, /<img[^>]+src="(https:\/\/s3\.iautos\.cn\/[^\"]+)"/i), new Set(["s3.iautos.cn"]))
    if (!sourceUrl || !date || !month || mileageWan === null || priceWan === null || priceWan <= 0) continue
    candidates.push({
      sourceId, sourceUrl, sourcePrice: Math.round(priceWan * 10_000), year: Number(date),
      manufacturedMonth: `${date}-${month}`, mileage: Math.round(mileageWan * 10_000), imageUrl,
    })
  }
  return candidates
}

function parseGoonetCatalog(html: string): PublicAuctionCandidate[] {
  const candidates: PublicAuctionCandidate[] = []
  for (const match of html.matchAll(/<a\s+class="spread_link_new_tab"\s+href="(\/usedcars\/[^\"]+\/(\d+)\/)"/gi)) {
    candidates.push({ sourceId: match[2], sourceUrl: `https://www.goo-net-exchange.com${match[1]}` })
  }
  return candidates
}

function parseCarvagoSitemap(xml: string): PublicAuctionCandidate[] {
  const candidates: PublicAuctionCandidate[] = []
  for (const match of xml.matchAll(/<loc>https?:\/\/carvago\.com\/car\/(\d+)\/([^<]+)<\/loc>/gi)) {
    candidates.push({ sourceId: match[1], sourceUrl: `https://carvago.com/car/${match[1]}/${decodeHtml(match[2])}` })
  }
  return candidates
}

export async function discoverPublicAuctionCandidates(source: PublicAuctionSource, page: number, limit: number) {
  const html = await sourceHtml(source, publicSourceCatalogUrl(source, page))
  const all = source === "IAUTOS" ? parseIautosCatalog(html) : source === "GOONET" ? parseGoonetCatalog(html) : parseCarvagoSitemap(html)
  if (!all.length) throw new Error(`${source}: публичный каталог не содержит распознаваемых карточек`)
  if (source === "IAUTOS") return { total: all.length, candidates: all.slice(0, limit) }
  const start = ((page - 1) * limit) % all.length
  return { total: all.length, candidates: [...all.slice(start), ...all.slice(0, start)].slice(0, limit) }
}

function overviewPairs(html: string) {
  const result = new Map<string, string>()
  for (const match of html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)) {
    const key = htmlText(match[1])
    const value = htmlText(match[2])
    if (key && value) result.set(key, value)
  }
  return result
}

function tablePairs(html: string) {
  const result = new Map<string, string>()
  for (const match of html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi)) {
    const key = htmlText(match[1])
    const value = htmlText(match[2])
    if (key && value) result.set(key, value)
  }
  return result
}

async function fetchIautosListing(candidate: PublicAuctionCandidate): Promise<AuctionImportItem> {
  if (!/^\d+$/.test(candidate.sourceId) || !/^https:\/\/www\.iautos\.cn\/usedcar-\d+\.html$/.test(candidate.sourceUrl)) throw new Error("Некорректная карточка Iautos")
  if (!candidate.sourcePrice || !candidate.year) throw new Error(`Iautos: нет каталожной цены карточки ${candidate.sourceId}`)
  const html = await sourceHtml("IAUTOS", candidate.sourceUrl)
  if (!html.includes(`usedcar-${candidate.sourceId}`) && !html.includes(`车源编号：<i>${candidate.sourceId}</i>`)) throw new PublicListingUnavailableError(`Iautos: карточка ${candidate.sourceId} отсутствует`)
  const title = htmlText(firstMatch(html, /<h1 class="title[^\"]*"[^>]*><span>([\s\S]*?)<\/span><\/h1>/i))
  if (!title) throw new Error(`Iautos: у карточки ${candidate.sourceId} нет названия`)
  const makeEntry = CHINESE_MAKES.find(([label]) => title.includes(label))
  if (!makeEntry) throw new Error(`Iautos: не распознана марка карточки ${candidate.sourceId}`)
  const modelOriginal = title.replace(makeEntry[0], "").trim()
  const deterministicModel = normalizeAuctionModel(localizeChineseModel(modelOriginal))
  const model = deterministicModel || normalizeAuctionModel(await translateToRussian(modelOriginal))
  if (!model) throw new Error(`Iautos: не переведена модель карточки ${candidate.sourceId}`)

  const pairs = tablePairs(html)
  const iautosImageHosts = new Set(["qimg.iautos.cn", "s1.iautos.cn", "s2.iautos.cn", "s3.iautos.cn"])
  const images = [...new Set([...html.matchAll(/(?:src|data-original)="(https:\/\/(?:qimg|s[123])\.iautos\.cn\/[^\"]+\.(?:jpg|jpeg|png)(?:-[^\"]+)?)"/gi)]
    .map((match) => safeImage(match[1], iautosImageHosts)).filter((url): url is string => Boolean(url)))].slice(0, 60)
  if (!images.length && candidate.imageUrl) images.push(candidate.imageUrl)
  const descriptionOrig = htmlText(firstMatch(html, /<p class="see-one-part"[^>]*>([\s\S]*?)<\/p>/i))
  const engineText = pairs.get("发动机") || firstMatch(title, /(\d+(?:\.\d+)?L)/i)
  const power = asNumber(pairs.get("发动机功率")?.match(/(\d+)马力/)?.[1])
  const displacement = asNumber(engineText?.match(/([\d.]+)L/i)?.[1])
  return {
    source: "IAUTOS", sourceId: candidate.sourceId, sourceUrl: candidate.sourceUrl,
    make: makeEntry[1], model, year: candidate.year, manufacturedMonth: candidate.manufacturedMonth || null,
    sourcePrice: candidate.sourcePrice, sourceCurrency: "CNY", country: "CN", auctionDate: null,
    mileage: candidate.mileage ?? null, fuelType: normalizeAuctionFuelType(pairs.get("燃料类型")),
    transmission: normalizeAuctionTransmission(pairs.get("变速箱")), bodyType: normalizeAuctionBodyType(pairs.get("车身结构") || pairs.get("车辆级别")),
    color: pairs.get("颜色") || null, engineVolume: displacement, power: power ? Math.round(power) : null,
    driveType: normalizeAuctionDriveType(pairs.get("驱动方式")), vin: null, lotNumber: candidate.sourceId,
    imageUrl: images[0] || null, images, descriptionOrig,
    specsOrig: [...pairs.entries()].slice(0, 20).map(([key, value]) => `${key}: ${value}`).join("; ") || null,
    location: htmlText(firstMatch(html, /<h6 class="t">所在地<\/h6>\s*<p class="d[^\"]*">([\s\S]*?)<\/p>/i)),
  }
}

async function fetchGoonetListing(candidate: PublicAuctionCandidate): Promise<AuctionImportItem> {
  if (!/^\d+$/.test(candidate.sourceId) || !candidate.sourceUrl.startsWith("https://www.goo-net-exchange.com/usedcars/")) throw new Error("Некорректная карточка Goo-net")
  const html = await sourceHtml("GOONET", candidate.sourceUrl)
  const jsonText = firstMatch(html, /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i)
  if (!jsonText) throw new PublicListingUnavailableError(`Goo-net: карточка ${candidate.sourceId} отсутствует`)
  let product: UnknownRecord
  try { product = JSON.parse(jsonText) as UnknownRecord } catch { throw new Error(`Goo-net: повреждены данные карточки ${candidate.sourceId}`) }
  const brand = asText(asRecord(product.brand)?.name)
  const title = asText(product.name)
  const offers = asRecord(product.offers)
  const sourcePrice = asNumber(offers?.price)
  const overview = overviewPairs(html)
  const date = overview.get("Month/Year")?.match(/(0[1-9]|1[0-2])\.(\d{4})/)
  const make = normalizeAuctionMake(brand)
  const model = normalizeAuctionModel(title && brand ? title.replace(new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "") : title)
  if (!make || !model || !sourcePrice || !date) throw new Error(`Goo-net: неполная карточка ${candidate.sourceId}`)
  const images = [...new Set([...html.matchAll(/https:\/\/picture1\.goo-net\.com\/[^\s"')]+\.(?:jpg|jpeg|png)/gi)]
    .map((match) => safeImage(match[0], new Set(["picture1.goo-net.com"]))).filter((url): url is string => Boolean(url)))].slice(0, 60)
  const fuelType = normalizeAuctionFuelType(overview.get("Fuel"))
  return {
    source: "GOONET", sourceId: candidate.sourceId, sourceUrl: candidate.sourceUrl,
    make, model, year: Number(date[2]), manufacturedMonth: `${date[2]}-${date[1]}`,
    sourcePrice: Math.round(sourcePrice), sourceCurrency: "JPY", country: "JP", auctionDate: null,
    mileage: asNumber(overview.get("Mileage")?.replace(/[^\d]/g, "")), fuelType,
    transmission: normalizeAuctionTransmission(overview.get("Transmission")), bodyType: null,
    color: asText(product.color), engineVolume: asNumber(overview.get("Displacement")?.replace(/[^\d.]/g, "")),
    power: null, driveType: normalizeAuctionDriveType(overview.get("Drive System")),
    vin: overview.get("Chassis No") || null, lotNumber: candidate.sourceId,
    imageUrl: images[0] || safeImage(asText(product.image), new Set(["picture1.goo-net.com"])), images,
    descriptionOrig: `${title}. Автомобиль опубликован в открытом каталоге Goo-net Exchange.`,
    specsOrig: [...overview.entries()].slice(0, 20).map(([key, value]) => `${key}: ${value}`).join("; ") || null,
    location: "Japan",
  }
}

function nextData(html: string) {
  const marker = html.indexOf("__NEXT_DATA__")
  if (marker < 0) return null
  const start = html.indexOf(">", marker) + 1
  const end = html.indexOf("</script>", start)
  if (start <= 0 || end <= start) return null
  try { return JSON.parse(html.slice(start, end)) as UnknownRecord } catch { return null }
}

function carBodyFromClass(value: string | null) {
  if (!value) return null
  if (/SUV/i.test(value)) return "SUV"
  if (/WAGON|ESTATE/i.test(value)) return "WAGON"
  if (/VAN|MPV/i.test(value)) return "MINIVAN"
  if (/COUPE/i.test(value)) return "COUPE"
  if (/HATCH/i.test(value)) return "HATCHBACK"
  if (/SEDAN|SALOON/i.test(value)) return "SEDAN"
  return null
}

async function fetchCarvagoListing(candidate: PublicAuctionCandidate): Promise<AuctionImportItem> {
  if (!/^\d+$/.test(candidate.sourceId) || !candidate.sourceUrl.startsWith(`https://carvago.com/car/${candidate.sourceId}/`)) throw new Error("Некорректная карточка Carvago")
  const html = await sourceHtml("CARVAGO", candidate.sourceUrl)
  const root = nextData(html)
  const pageProps = asRecord(asRecord(asRecord(root?.props)?.pageProps))
  const car = asRecord(pageProps?.carData)
  if (!car || pageProps?.carUnavailable === true || asText(car.status) !== "active" || car.tradable === false) throw new PublicListingUnavailableError(`Carvago: карточка ${candidate.sourceId} снята с публикации`)
  const make = normalizeAuctionMake(asText(asRecord(car.make)?.label))
  const model = normalizeAuctionModel(asText(asRecord(car.model)?.label) || asText(car.title))
  const registrationDate = asText(car.registration_date) || asText(car.manufacture_date)
  const date = registrationDate?.match(/^(\d{4})-(0[1-9]|1[0-2])-/)
  const price = asNumber(asRecord(asRecord(car.price_information)?.nice_price_data)?.price)
  if (String(car.id) !== candidate.sourceId || !make || !model || !date || !price) throw new Error(`Carvago: неполная карточка ${candidate.sourceId}`)
  const images = (Array.isArray(car.images) ? car.images : []).flatMap((entry) => {
    const url = safeImage(asText(asRecord(entry)?.path), new Set(["storage.alpha-analytics.cz"]))
    return url ? [url] : []
  }).slice(0, 60)
  const metaDescription = decodeHtml(firstMatch(html, /<meta\s+name="description"\s+content="([^"]*)"/i) || "") || null
  const electric = Boolean(asRecord(car.electric_vehicle_feature)?.battery_capacity_kwh)
  const fuelType = electric ? "ELECTRIC" : normalizeAuctionFuelType(metaDescription?.match(/\b(Electric|Diesel|Petrol|Hybrid)\b/i)?.[1])
  const transmission = normalizeAuctionTransmission(metaDescription?.match(/\b(Automatic|Manual)\b/i)?.[1])
  return {
    source: "CARVAGO", sourceId: candidate.sourceId, sourceUrl: candidate.sourceUrl,
    make, model, year: Number(date[1]), manufacturedMonth: `${date[1]}-${date[2]}`,
    sourcePrice: Math.round(price), sourceCurrency: "EUR", country: "DE", auctionDate: null,
    mileage: asNumber(car.mileage), fuelType, transmission, bodyType: carBodyFromClass(asText(car.vehicle_class)),
    color: null, engineVolume: electric ? null : asNumber(car.cubic_capacity), power: asNumber(car.power_hp),
    driveType: null, vin: asText(car.vin), lotNumber: candidate.sourceId,
    imageUrl: images[0] || safeImage(asText(asRecord(car.image)?.path), new Set(["storage.alpha-analytics.cz"])), images,
    descriptionOrig: asText(car.description) || metaDescription,
    specsOrig: [`Power: ${asNumber(car.power_hp) || "—"} hp`, `Mileage: ${asNumber(car.mileage) || "—"} km`, `Seller country: ${asText(asRecord(car.location_country)?.name) || "Europe"}`].join("; "),
    location: [asText(car.location_city), asText(asRecord(car.location_country)?.name)].filter(Boolean).join(", ") || "Europe",
  }
}

export function fetchPublicAuctionListing(source: PublicAuctionSource, candidate: PublicAuctionCandidate) {
  if (source === "IAUTOS") return fetchIautosListing(candidate)
  if (source === "GOONET") return fetchGoonetListing(candidate)
  return fetchCarvagoListing(candidate)
}
