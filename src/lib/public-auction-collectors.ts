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

export const PUBLIC_AUCTION_SOURCES = [
  "IAUTOS",
  "YOUXINPAI",
  "GOONET",
  "BEFORWARD",
  "CARSENSOR",
  "CARVAGO",
  "AUTOSALE",
  "BOBAEDREAM",
] as const
export type PublicAuctionSource = (typeof PUBLIC_AUCTION_SOURCES)[number]

export type PublicAuctionCandidate = {
  sourceId: string
  sourceUrl: string
  sourcePrice?: number
  year?: number
  manufacturedMonth?: string | null
  mileage?: number | null
  imageUrl?: string | null
  make?: string | null
  model?: string | null
  fuelType?: string | null
  transmission?: string | null
  bodyType?: string | null
  auctionDate?: Date | null
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
  YOUXINPAI: new Set(["api.youxinpai.cn", "www.youxinpai.cn"]),
  GOONET: new Set(["www.goo-net-exchange.com"]),
  BEFORWARD: new Set(["www.beforward.jp"]),
  CARSENSOR: new Set(["www.carsensor.net"]),
  CARVAGO: new Set(["carvago.com", "www.carvago.com"]),
  AUTOSALE: new Set(["autosale.ee"]),
  BOBAEDREAM: new Set(["www.bobaedream.co.kr"]),
}

const JAPANESE_MAKES: Readonly<Record<string, string>> = {
  "トヨタ": "Toyota", "ホンダ": "Honda", "日産": "Nissan", "ニッサン": "Nissan",
  "スズキ": "Suzuki", "ダイハツ": "Daihatsu", "三菱": "Mitsubishi", "マツダ": "Mazda",
  "スバル": "Subaru", "レクサス": "Lexus", "いすゞ": "Isuzu", "日野自動車": "Hino",
  "メルセデス・ベンツ": "Mercedes-Benz", "フォルクスワーゲン": "Volkswagen",
  "アウディ": "Audi", "ポルシェ": "Porsche", "ボルボ": "Volvo", "プジョー": "Peugeot",
  "ルノー": "Renault", "シトロエン": "Citroen", "フィアット": "Fiat", "ミニ": "MINI",
  "ランドローバー": "Land Rover", "ジャガー": "Jaguar", "ジープ": "Jeep",
  "シボレー": "Chevrolet", "フォード": "Ford", "ヒョンデ": "Hyundai", "起亜": "Kia",
}

const KATAKANA_ROMAJI: Readonly<Record<string, string>> = {
  ア: "a", イ: "i", ウ: "u", エ: "e", オ: "o", カ: "ka", キ: "ki", ク: "ku", ケ: "ke", コ: "ko",
  サ: "sa", シ: "shi", ス: "su", セ: "se", ソ: "so", タ: "ta", チ: "chi", ツ: "tsu", テ: "te", ト: "to",
  ナ: "na", ニ: "ni", ヌ: "nu", ネ: "ne", ノ: "no", ハ: "ha", ヒ: "hi", フ: "fu", ヘ: "he", ホ: "ho",
  マ: "ma", ミ: "mi", ム: "mu", メ: "me", モ: "mo", ヤ: "ya", ユ: "yu", ヨ: "yo", ラ: "ra", リ: "ri",
  ル: "ru", レ: "re", ロ: "ro", ワ: "wa", ヲ: "o", ン: "n", ガ: "ga", ギ: "gi", グ: "gu", ゲ: "ge",
  ゴ: "go", ザ: "za", ジ: "ji", ズ: "zu", ゼ: "ze", ゾ: "zo", ダ: "da", ヂ: "ji", ヅ: "zu", デ: "de",
  ド: "do", バ: "ba", ビ: "bi", ブ: "bu", ベ: "be", ボ: "bo", パ: "pa", ピ: "pi", プ: "pu", ペ: "pe",
  ポ: "po", ヴ: "vu", ァ: "a", ィ: "i", ゥ: "u", ェ: "e", ォ: "o", ャ: "ya", ュ: "yu", ョ: "yo",
  ー: "-",
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
  [/200万辆悦享版/g, "юбилейная комплектация Enjoy"],
  [/40TFSI豪华动感型B&O星夜版/g, "40 TFSI Luxury Dynamic B&O Starry Night"],
  [/改款领先型M运动套装/g, "рестайлинг Leading, пакет M Sport"],
  [/动感型运动版/g, "Dynamic Sport"], [/旗舰动感型/g, "Flagship Dynamic"],
  [/星耀臻藏版/g, "Star Premium"], [/劲势版/g, "Power"], [/思域/g, "Civic"],
  [/(\d{4})款/g, "$1"], [/([A-Z])级/gi, "$1-Class"], [/(\d+)系/g, "$1 Series"],
  [/自动/g, "АКПП"], [/手动/g, "МКПП"], [/前驱/g, "передний привод"], [/后驱/g, "задний привод"],
  [/四驱|全驱/g, "полный привод"], [/运动型|运动版/g, "Sport"], [/时尚版/g, "Style"],
  [/豪华版/g, "Luxury"], [/尊贵版/g, "Premium"], [/旗舰版/g, "Flagship"], [/标准版/g, "Standard"],
  [/舒适版/g, "Comfort"], [/卓越版/g, "Excellence"], [/臻享版/g, "Premium"],
  [/\(国Ⅵ\)|\(国VI\)/gi, "экостандарт China VI"], [/\(国Ⅴ\)|\(国V\)/gi, "экостандарт China V"],
]

const BOBAEDREAM_EQUIPMENT_LABELS: Readonly<Record<string, string>> = {
  "선루프": "Люк",
  "파노라마선루프": "Панорамная крыша",
  "알루미늄휠": "Легкосплавные диски",
  "전동사이드미러": "Электропривод зеркал",
  "HID램프": "Ксеноновые фары",
  "LED헤드램프": "Светодиодные фары",
  "어댑티드헤드램프": "Адаптивные фары",
  "LED리어램프": "Светодиодные задние фонари",
  "데이라이트": "Дневные ходовые огни",
  "하이빔어시스트": "Автоматический дальний свет",
  "압축도어": "Доводчики дверей",
  "자동슬라이딩도어": "Автоматические сдвижные двери",
  "전동사이드스탭": "Электрические подножки",
  "루프랙": "Рейлинги на крыше",
  "가죽시트": "Кожаный салон",
  "전동시트(운전석)": "Электропривод сиденья водителя",
  "전동시트(동승석)": "Электропривод сиденья пассажира",
  "열선시트(앞좌석)": "Подогрев передних сидений",
  "열선시트(뒷좌석)": "Подогрев задних сидений",
  "통풍시트": "Вентиляция сидений",
  "메모리시트": "Память настроек сидений",
  "폴딩시트": "Складные сиденья",
  "마사지시트": "Массаж сидений",
  "워크인시트": "Сиденье с облегчённым доступом",
  "요추받침": "Поясничная поддержка",
  "하이패스룸미러": "Зеркало с системой Hi-Pass",
  "ECM룸미러": "Зеркало с автозатемнением",
  "뒷좌석에어벤트": "Воздуховоды для задних пассажиров",
  "패들쉬프트": "Подрулевые переключатели",
  "전동햇빛가리개": "Электрические солнцезащитные шторки",
  "엠비언트라이트": "Контурная подсветка салона",
  "동승석에어백": "Подушка безопасности пассажира",
  "측면에어백": "Боковые подушки безопасности",
  "커튼에어백": "Шторки безопасности",
  "무릎에어백": "Коленная подушка безопасности",
  "승객감지에어백": "Система распознавания пассажира",
  "브레이크잠김방지(ABS)": "Антиблокировочная система",
  "차체자세제어장치(ESC)": "Система стабилизации",
  "후방센서": "Задние парктроники",
  "전방센서": "Передние парктроники",
  "후방카메라": "Камера заднего вида",
  "전방카메라": "Передняя камера",
  "어라운드뷰": "Круговой обзор",
  "타이어공기압감지(TPMS)": "Контроль давления в шинах",
  "차선이탈경보(LDWS)": "Контроль полосы движения",
  "자동긴급제동": "Автоматическое экстренное торможение",
  "전자제어서스펜션(ECS)": "Электронноуправляемая подвеска",
  "후측방경보": "Контроль слепых зон",
  "미끄럼방지(TCS)": "Противобуксовочная система",
  "스마트키": "Бесключевой доступ",
  "열선핸들": "Подогрев рулевого колеса",
  "리모컨핸들": "Управление мультимедиа на руле",
  "자동에어컨": "Климат-контроль",
  "좌우독립에어컨": "Раздельный климат-контроль",
  "오토라이트": "Автоматическое включение света",
  "크루즈컨트롤": "Круиз-контроль",
  "스마트크루즈컨트롤": "Адаптивный круиз-контроль",
  "스탑앤고": "Система старт-стоп",
  "전동트렁크": "Электропривод багажника",
  "스마트트렁크": "Бесконтактное открытие багажника",
  "전자주차브레이크(EPB)": "Электронный стояночный тормоз",
  "경사로밀림방지": "Помощь при старте на подъёме",
  "헤드업디스플레이(HUD)": "Проекционный дисплей",
  "무선충전": "Беспроводная зарядка",
  "자동주차": "Автоматическая парковка",
  "냉장고": "Холодильник",
  "네비게이션(순정)": "Штатная навигация",
  "네비게이션(비순정)": "Дополнительная навигация",
  "USB": "USB-разъёмы",
  "AUX": "Аудиовход AUX",
  "블루투스": "Bluetooth",
  "MP3": "Поддержка MP3",
  "DMB": "Цифровое телевидение",
  "CD플레이어": "CD-проигрыватель",
  "AV시스템": "Мультимедийная система",
  "뒷좌석TV": "Экраны для задних пассажиров",
  "텔레매틱스": "Телематическая система",
  "스마트폰미러링": "Интеграция со смартфоном",
}

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

function bobaedreamWon(value: string | null | undefined) {
  const tenThousands = asNumber(value?.match(/([\d,]+)\s*만원/)?.[1]?.replace(/,/g, ""))
  return tenThousands === null ? null : Math.round(tenThousands * 10_000)
}

function bobaedreamEquipment(html: string) {
  const items = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].flatMap((match) => {
    const block = match[1]
    if (!/\bchecked\b/i.test(block)) return []
    const rawLabel = htmlText(firstMatch(block, /<button[^>]*>([\s\S]*?)<\/button>/i))
    const label = rawLabel ? BOBAEDREAM_EQUIPMENT_LABELS[rawLabel] : null
    return label ? [{ label, available: true }] : []
  })
  const uniqueItems = [...new Map(items.map((item) => [item.label, item])).values()]
  return uniqueItems.length ? { totalReported: uniqueItems.length, items: uniqueItems.slice(0, 60) } : null
}

function firstMatch(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1]?.trim() || null
}

function safeImage(value: string | null, allowedHosts: ReadonlySet<string>) {
  if (!value) return null
  try {
    const decoded = decodeHtml(value)
    const url = new URL(decoded.startsWith("//") ? `https:${decoded}` : decoded)
    return url.protocol === "https:" && allowedHosts.has(url.hostname) ? url.toString() : null
  } catch {
    return null
  }
}

function titleCaseSlug(value: string) {
  return value.split("-").filter(Boolean).map((part) => part ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : "").join(" ")
}

function romanizeJapanese(value: string) {
  const normalized = value.normalize("NFKC")
    .replace(/\u30b7\u30ea\u30fc\u30ba/g, " Series")
    .replace(/\u30cf\u30a4\u30d6\u30ea\u30c3\u30c9/g, " Hybrid")
    .replace(/\u30ab\u30b9\u30bf\u30e0/g, " Custom")
    .replace(/\u30c4\u30fc\u30ea\u30f3\u30b0/g, " Touring")
    .replace(/\u30b9\u30dd\u30fc\u30c4/g, " Sport")
    .replace(/\u30bf\u30fc\u30dc/g, " Turbo")
    .replace(/\u30a8\u30c7\u30a3\u30b7\u30e7\u30f3/g, " Edition")
    .replace(/\u30d1\u30c3\u30b1\u30fc\u30b8/g, " Package")
  let result = ""
  let doubleNext = false
  for (const character of normalized) {
    if (character === "ッ") {
      doubleNext = true
      continue
    }
    const syllable = KATAKANA_ROMAJI[character]
    if (!syllable) {
      result += character
      doubleNext = false
      continue
    }
    result += doubleNext && /^[a-z]/.test(syllable) ? `${syllable[0]}${syllable}` : syllable
    doubleNext = false
  }
  return result.replace(/([aeiou])-+/g, "$1").replace(/[\u3040-\u30FF\u3400-\u9FFF]+/g, " ").replace(/\s+/g, " ").trim()
}

function jsonLdObjects(html: string) {
  const objects: UnknownRecord[] = []
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]) as unknown
      const values = Array.isArray(parsed) ? parsed : [parsed]
      for (const value of values) {
        const record = asRecord(value)
        if (record) objects.push(record)
      }
    } catch {
      // Some providers publish almost-JSON with trailing commas. Their stable
      // fields are parsed from the HTML below instead of trusting broken data.
    }
  }
  return objects
}

function localizeChineseModel(value: string) {
  return CHINESE_MODEL_TERMS.reduce((model, [pattern, replacement]) => model.replace(pattern, replacement), value)
    .replace(/\s+/g, " ")
    .trim()
}

async function sourceHtml(source: PublicAuctionSource, url: string) {
  const rangeHeaders = source === "BEFORWARD" && /\/detail\d+\.xml$/i.test(url)
    ? { ...SOURCE_HEADERS, Range: "bytes=0-999999" }
    : SOURCE_HEADERS
  const response = await authorizedSourceGet(url, {
    allowedHosts: SOURCE_HOSTS[source], headers: rangeHeaders,
    timeoutMs: source === "BOBAEDREAM" ? 45_000 : SOURCE_TIMEOUT_MS, maxBytes: SOURCE_MAX_BYTES,
  })
  if (response.status === 404 || response.status === 410) throw new PublicListingUnavailableError(`Карточка ${source} снята с публикации`)
  if (!response.ok) throw new Error(`${source} вернул HTTP ${response.status}`)
  return response.text()
}

export function publicSourceCatalogUrl(source: PublicAuctionSource, page: number) {
  if (source === "IAUTOS") return page <= 1 ? "https://so.iautos.cn/quanguo/" : `https://so.iautos.cn/quanguo/p${page}asdsvepcatcpbnscac/#buyCars`
  if (source === "YOUXINPAI") return `https://api.youxinpai.cn/api/auction/list?pageNum=${page}&pageSize=20&auctionType=1`
  if (source === "GOONET") return "https://www.goo-net-exchange.com/php/search/summary.php?year_min=2021&search_type=year_search"
  if (source === "BEFORWARD") return `https://www.beforward.jp/detail${String(page).padStart(3, "0")}.xml`
  if (source === "CARSENSOR") return `https://www.carsensor.net/usedcar-detail-${page % 10 + 1}.xml`
  if (source === "AUTOSALE") return "https://autosale.ee/sitemap.php"
  if (source === "BOBAEDREAM") return `https://www.bobaedream.co.kr/mycar/mycar_list.php?gubun=K&page=${page}`
  return "https://carvago.com/sitemap-listed-cars.xml"
}

export function publicSourceMaximumPage(source: PublicAuctionSource) {
  if (source === "IAUTOS" || source === "BOBAEDREAM") return 50
  if (source === "GOONET" || source === "BEFORWARD") return 20
  if (source === "CARSENSOR") return 10
  if (source === "YOUXINPAI") return 5
  if (source === "AUTOSALE") return 1
  return 200
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

function uniqueCandidates(candidates: PublicAuctionCandidate[]) {
  return [...new Map(candidates.map((candidate) => [candidate.sourceId, candidate])).values()]
}

function parseBobaedreamCatalog(html: string) {
  const candidates: PublicAuctionCandidate[] = []
  for (const match of html.matchAll(/(?:href=["'])?(?:https:\/\/www\.bobaedream\.co\.kr)?\/mycar\/mycar_view\.php\?no=(\d+)(?:&amp;|&)gubun=K/gi)) {
    candidates.push({
      sourceId: match[1],
      sourceUrl: `https://www.bobaedream.co.kr/mycar/mycar_view.php?no=${match[1]}&gubun=K`,
    })
  }
  return uniqueCandidates(candidates)
}

function parseBeforwardSitemap(xml: string) {
  const candidates: PublicAuctionCandidate[] = []
  for (const match of xml.matchAll(/<loc>(https:\/\/www\.beforward\.jp\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\/id\/(\d+)\/)<\/loc>/gi)) {
    candidates.push({ sourceId: match[2], sourceUrl: decodeHtml(match[1]) })
  }
  return uniqueCandidates(candidates)
}

function parseCarsensorSitemap(xml: string) {
  const candidates: PublicAuctionCandidate[] = []
  for (const match of xml.matchAll(/<loc>(https:\/\/www\.carsensor\.net\/usedcar\/detail\/(AU\d+)\/index\.html)<\/loc>/gi)) {
    candidates.push({ sourceId: match[2], sourceUrl: match[1] })
  }
  return uniqueCandidates(candidates)
}

function parseAutosaleSitemap(xml: string) {
  const candidates: PublicAuctionCandidate[] = []
  for (const match of xml.matchAll(/<loc>(https:\/\/autosale\.ee\/listings\/view\.php\?id=(\d+))<\/loc>/gi)) {
    candidates.push({ sourceId: match[2], sourceUrl: decodeHtml(match[1]) })
  }
  return uniqueCandidates(candidates)
}

const youxinpaiCatalogCache = new Map<number, { expiresAt: number; candidates: PublicAuctionCandidate[] }>()

function parseYouxinpaiCatalog(json: string, pageNumber: number) {
  let root: UnknownRecord
  try { root = JSON.parse(json) as UnknownRecord } catch { throw new Error("YOUXINPAI: повреждены данные каталога") }
  const page = asRecord(asRecord(root.data)?.page)
  const records = Array.isArray(page?.records) ? page.records : []
  const candidates: PublicAuctionCandidate[] = []
  for (const value of records) {
    const record = asRecord(value)
    const sourceId = asNumber(record?.publishId)
    const price = asNumber(record?.startPrice) || asNumber(record?.currentHighestBid) || asNumber(record?.refPriceLow)
    const registered = asText(record?.registerDate)?.match(/^(\d{4})-(\d{2})-/)
    const make = normalizeAuctionMake(asText(record?.brandName))
    const model = normalizeAuctionModel(asText(record?.modelName) || asText(record?.serialName))
    const image = asText(record?.mainImage)?.replace("/paipic/small/", "/paipic/").replace(/\?format=webp$/i, "") || null
    if (!sourceId || !price || !registered || !make || !model || asNumber(record?.auctionStatus) !== 1) continue
    const bodyCode = asNumber(record?.bodyType)
    const fuelCode = asNumber(record?.fuelType)
    candidates.push({
      sourceId: String(sourceId), sourceUrl: `https://www.youxinpai.cn/auction/detail?publishId=${sourceId}`,
      sourcePrice: Math.round(price), year: Number(registered[1]), manufacturedMonth: `${registered[1]}-${registered[2]}`,
      mileage: asNumber(record?.mileage), imageUrl: safeImage(image, new Set(["img.youxinpai.cn"])), make, model,
      fuelType: fuelCode === 1 ? "DIESEL" : fuelCode === 2 ? "HYBRID" : fuelCode === 3 ? "ELECTRIC" : "GASOLINE",
      transmission: asNumber(record?.gearbox) === 1 ? "AUTOMATIC" : null,
      bodyType: bodyCode === 1 ? "SEDAN" : bodyCode === 3 ? "SUV" : null,
      auctionDate: (() => {
        const timestamp = asNumber(record?.priceStopTime)
        return timestamp ? new Date(timestamp) : null
      })(),
    })
  }
  const unique = uniqueCandidates(candidates)
  youxinpaiCatalogCache.set(pageNumber, { expiresAt: Date.now() + 2 * 60_000, candidates: unique })
  return unique
}

export async function discoverPublicAuctionCandidates(source: PublicAuctionSource, page: number, limit: number) {
  const html = await sourceHtml(source, publicSourceCatalogUrl(source, page))
  const all = source === "IAUTOS" ? parseIautosCatalog(html)
    : source === "YOUXINPAI" ? parseYouxinpaiCatalog(html, page)
      : source === "GOONET" ? parseGoonetCatalog(html)
        : source === "BEFORWARD" ? parseBeforwardSitemap(html)
          : source === "CARSENSOR" ? parseCarsensorSitemap(html)
            : source === "AUTOSALE" ? parseAutosaleSitemap(html)
              : source === "BOBAEDREAM" ? parseBobaedreamCatalog(html)
                : parseCarvagoSitemap(html)
  if (!all.length) throw new Error(`${source}: публичный каталог не содержит распознаваемых карточек`)
  if (source === "IAUTOS" || source === "YOUXINPAI" || source === "BOBAEDREAM") return { total: all.length, candidates: all.slice(0, limit) }
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

async function fetchBobaedreamListing(candidate: PublicAuctionCandidate): Promise<AuctionImportItem> {
  if (!/^\d+$/.test(candidate.sourceId) || !candidate.sourceUrl.startsWith("https://www.bobaedream.co.kr/mycar/mycar_view.php?no=")) throw new Error("Некорректная карточка Bobaedream")
  const html = await sourceHtml("BOBAEDREAM", candidate.sourceUrl)
  const titleBlock = firstMatch(html, /<div class="title-area">[\s\S]*?<h3 class="tit">([\s\S]*?)<\/h3>/i)
  const title = htmlText(titleBlock)?.split("-")[0]?.trim() || null
  const priceTenThousandWon = asNumber(firstMatch(html, /<div class="price-area">[\s\S]*?<span class="price">\s*<b[^>]*>\s*([\d,]+)\s*<\/b>\s*만원/i)?.replace(/,/g, ""))
  if (!title) throw new PublicListingUnavailableError(`Bobaedream: карточка ${candidate.sourceId} снята с публикации`)

  const [rawMake, ...modelParts] = title.split(/\s+/)
  const make = normalizeAuctionMake(rawMake)
  const model = normalizeAuctionModel(modelParts.join(" "))
  if (!make || !model || /[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/.test(make)) throw new Error(`Bobaedream: не распознаны марка или модель карточки ${candidate.sourceId}`)
  const pairs = tablePairs(html)
  const registration = pairs.get("연식")?.match(/(\d{4})\.(\d{2})/) || htmlText(firstMatch(html, /<p class="state">([\s\S]*?)<\/p>/i))?.match(/(\d{2})년\s*(\d{2})월/)
  if (!registration) throw new Error(`Bobaedream: нет даты выпуска карточки ${candidate.sourceId}`)
  const fullYear = registration[1].length === 2 ? 2000 + Number(registration[1]) : Number(registration[1])
  const month = registration[2]
  const bobaImageHosts = new Set(["file1.bobaedream.co.kr", "file2.bobaedream.co.kr", "file3.bobaedream.co.kr", "file4.bobaedream.co.kr", "file5.bobaedream.co.kr"])
  const images = [...new Set([...html.matchAll(/(?:https?:)?\/\/file[1-5]\.bobaedream\.co\.kr\/[^"]+?\.(?:jpg|jpeg|png)/gi)]
    .map((match) => safeImage(match[0], bobaImageHosts)).filter((url): url is string => Boolean(url)))].slice(0, 60)
  const engineText = pairs.get("배기량") || null
  const power = asNumber(engineText?.match(/([\d,]+)\s*마력/)?.[1]?.replace(/,/g, ""))
  const engineVolume = asNumber(engineText?.match(/([\d,]+)\s*cc/i)?.[1]?.replace(/,/g, ""))
  const mileage = asNumber(pairs.get("주행거리")?.replace(/[^\d]/g, ""))
  const fuelType = normalizeAuctionFuelType(pairs.get("연료"))
  const transmission = normalizeAuctionTransmission(pairs.get("변속기"))
  const rentalSummary = firstMatch(html, /<div class="price-area">([\s\S]*?)<\/div>\s*<div class="btn-area">/i) || ""
  const monthlyRentFromSummary = asNumber(firstMatch(rentalSummary, /<span class="stit">\s*월렌트료\s*<\/span>[\s\S]*?<span class="price">\s*<b[^>]*>\s*([\d,]+)\s*<\/b>\s*만원/i)?.replace(/,/g, ""))
  const rentalMonthsFromSummary = rentalSummary.match(/<span class="stit">\s*잔여개월\s*<\/span>[\s\S]*?<b[^>]*>\s*(\d+)\s*\/\s*(\d+)\s*<\/b>/i)
  const tableValue = (label: string) => {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return htmlText(firstMatch(html, new RegExp(`<th[^>]*>\\s*${escapedLabel}\\s*<\\/th>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`, "i")))
  }
  const monthlyRentWon = bobaedreamWon(pairs.get("월렌트료") || tableValue("월렌트료"))
    || (monthlyRentFromSummary !== null ? Math.round(monthlyRentFromSummary * 10_000) : null)
  const transferSupportWon = bobaedreamWon(pairs.get("승계지원금") || tableValue("승계지원금")) || 0
  const depositWon = bobaedreamWon(pairs.get("보증금") || tableValue("보증금"))
  const residualValueWon = bobaedreamWon(pairs.get("잔존가치") || tableValue("잔존가치"))
  const rentalPeriod = pairs.get("렌트기간") || tableValue("렌트기간") || ""
  const remainingMonths = asNumber(rentalPeriod.match(/잔여\s*(\d+)\s*개월/)?.[1]) || asNumber(rentalMonthsFromSummary?.[1])
  const totalMonths = asNumber(rentalPeriod.match(/총\s*(\d+)\s*개월/)?.[1]) || asNumber(rentalMonthsFromSummary?.[2])
  const isRentalTransfer = monthlyRentWon !== null && monthlyRentWon > 0 && remainingMonths !== null && remainingMonths > 0
  const estimatedRemainingContractWon = isRentalTransfer
    ? Math.max(1, Math.round(monthlyRentWon * remainingMonths - transferSupportWon))
    : null
  const regularSalePriceWon = priceTenThousandWon !== null ? Math.round(priceTenThousandWon * 10_000) : null
  const sourcePrice = estimatedRemainingContractWon || regularSalePriceWon
  if (!sourcePrice || sourcePrice <= 0) throw new Error(`Bobaedream: в карточке ${candidate.sourceId} не удалось определить стоимость`)

  const ownershipAfterEnd = /소유/.test(pairs.get("만기 후") || tableValue("만기 후") || "")
  const warranty = pairs.get("보증정보") || null
  const equipment = bobaedreamEquipment(html)
  const bodyType = /카니발|Carnival/i.test(title) ? "MINIVAN"
    : /팰리세이드|GV\d+|SUV|Range Rover|싼타페|쏘렌토/i.test(title) ? "SUV"
      : normalizeAuctionBodyType(pairs.get("차종"))
  const driveType = /\bAWD\b|4WD|사륜/i.test(title) ? "AWD" : null
  const location = /서울/.test(html) ? "Сеул" : /부산/.test(html) ? "Пусан" : "Корея"
  const russianSpecs = [
    `Год выпуска: ${fullYear}`,
    mileage !== null ? `Пробег: ${mileage.toLocaleString("ru-RU")} км` : null,
    fuelType ? `Топливо: ${fuelType}` : null,
    transmission ? `КПП: ${transmission}` : null,
    engineVolume ? `Объём: ${engineVolume.toLocaleString("ru-RU")} см³` : null,
    power ? `Мощность: ${Math.round(power)} л.с.` : null,
    isRentalTransfer ? `Тип предложения: переоформление долгосрочной аренды` : null,
    isRentalTransfer ? `Ежемесячный платёж: ${monthlyRentWon.toLocaleString("ru-RU")} ₩` : null,
    isRentalTransfer && totalMonths ? `Осталось по договору: ${remainingMonths} из ${totalMonths} месяцев` : null,
    isRentalTransfer && transferSupportWon ? `Компенсация при переоформлении: ${transferSupportWon.toLocaleString("ru-RU")} ₩` : null,
    isRentalTransfer && depositWon !== null ? `Депозит: ${depositWon.toLocaleString("ru-RU")} ₩` : null,
    isRentalTransfer && residualValueWon !== null ? `Остаточная стоимость: ${residualValueWon.toLocaleString("ru-RU")} ₩` : null,
    isRentalTransfer ? `Расчётный остаток регулярных платежей: ${estimatedRemainingContractWon?.toLocaleString("ru-RU")} ₩ — это не цена продажи автомобиля` : null,
  ].filter(Boolean).join("; ")
  const conditionInfo = isRentalTransfer ? {
    insuranceRecordCount: null,
    inspectionSummary: warranty ? `Гарантия источника: ${warranty.replace(/개월/g, " месяцев").replace(/km/gi, "км")}` : null,
    newCarPriceRatioPct: null,
    verifiedItems: [
      { label: "Тип предложения", status: "Переоформление долгосрочной аренды" },
      { label: "Ежемесячный платёж", status: `${monthlyRentWon.toLocaleString("ru-RU")} ₩` },
      { label: "Осталось по договору", status: totalMonths ? `${remainingMonths} из ${totalMonths} месяцев` : `${remainingMonths} месяцев` },
      { label: "Переход собственности", status: ownershipAfterEnd ? "После окончания договора" : "Условия нужно подтвердить" },
    ],
  } : null
  return {
    source: "BOBAEDREAM", sourceId: candidate.sourceId, sourceUrl: candidate.sourceUrl,
    make, model, year: fullYear, manufacturedMonth: `${fullYear}-${month}`,
    sourcePrice, sourceCurrency: "KRW", country: "KR", auctionDate: null,
    mileage, fuelType,
    transmission, bodyType,
    color: pairs.get("색상") || null, engineVolume, power: power ? Math.round(power) : null,
    driveType, vin: null, lotNumber: candidate.sourceId,
    imageUrl: images[0] || null, images,
    descriptionOrig: isRentalTransfer
      ? `${make} ${model}. Переоформление долгосрочной аренды Bobaedream. Расчётный остаток регулярных платежей ${estimatedRemainingContractWon?.toLocaleString("ru-RU")} ₩; остаточная стоимость опубликована отдельно. Это не цена продажи автомобиля. Возможность выкупа и экспорта нужно подтвердить до расчёта доставки и таможенных платежей.`
      : `${make} ${model}. Автомобиль опубликован в открытом каталоге Bobaedream; данные проверяются по первоисточнику.`,
    specsOrig: russianSpecs || null,
    equipment,
    conditionInfo,
    location,
  }
}

async function fetchBeforwardListing(candidate: PublicAuctionCandidate): Promise<AuctionImportItem> {
  const path = candidate.sourceUrl.match(/^https:\/\/www\.beforward\.jp\/([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9-]+)\/id\/(\d+)\/$/i)
  if (!path || path[4] !== candidate.sourceId) throw new Error("Некорректная карточка BE FORWARD")
  const html = await sourceHtml("BEFORWARD", candidate.sourceUrl)
  if (!/"availability"\s*:\s*"https:\/\/schema\.org\/InStock"/i.test(html)) throw new PublicListingUnavailableError(`BE FORWARD: карточка ${candidate.sourceId} снята с публикации`)
  const sourcePrice = asNumber(firstMatch(html, /"price"\s*:\s*"([\d.]+)"/i))
  const make = normalizeAuctionMake(titleCaseSlug(path[1]))
  const model = normalizeAuctionModel(titleCaseSlug(path[2]))
  const pairs = tablePairs(html)
  const registrationText = pairs.get("Registration Year/month")
    || [...pairs.entries()].find(([key]) => key.replace(/\s+/g, "") === "RegistrationYear/month")?.[1]
    || htmlText(firstMatch(html, /Registration(?:\s|<br\s*\/?\s*>|<[^>]+>)*Year\/month[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i))
  const registered = registrationText?.match(/(\d{4})\/(\d{2})/)
  if (!sourcePrice || !make || !model || !registered) {
    const missing = [!sourcePrice && "цена", !make && "марка", !model && "модель", !registered && "дата"].filter(Boolean).join(", ")
    throw new Error(`BE FORWARD: в карточке ${candidate.sourceId} отсутствуют обязательные поля: ${missing}`)
  }
  const beforwardImageHosts = new Set(["image-cdn.beforward.jp"])
  const images = [...new Set([...html.matchAll(/(?:https?:)?\/\/image-cdn\.beforward\.jp\/[^"]+?\.(?:jpg|jpeg|png|webp)/gi)]
    .map((match) => safeImage(match[0], beforwardImageHosts)).filter((url): url is string => Boolean(url)))].slice(0, 60)
  const engineVolume = asNumber(pairs.get("Engine Size")?.replace(/[^\d.]/g, ""))
  return {
    source: "BEFORWARD", sourceId: candidate.sourceId, sourceUrl: candidate.sourceUrl,
    make, model, year: Number(registered[1]), manufacturedMonth: `${registered[1]}-${registered[2]}`,
    sourcePrice: Math.round(sourcePrice), sourceCurrency: "USD", country: "JP", auctionDate: null,
    mileage: asNumber(pairs.get("Mileage")?.replace(/[^\d]/g, "")), fuelType: normalizeAuctionFuelType(pairs.get("Fuel")),
    transmission: normalizeAuctionTransmission(pairs.get("Transmission")), bodyType: null,
    color: pairs.get("Ext. Color") || null, engineVolume, power: null,
    driveType: normalizeAuctionDriveType(pairs.get("Drive")), vin: pairs.get("Chassis No.") || null,
    lotNumber: pairs.get("Ref. No.") || path[3].toUpperCase(), imageUrl: images[0] || null, images,
    descriptionOrig: `${make} ${model}. Автомобиль из открытого экспортного каталога BE FORWARD.`,
    specsOrig: `Год выпуска: ${registered[1]}; пробег: ${asNumber(pairs.get("Mileage")?.replace(/[^\d]/g, ""))?.toLocaleString("ru-RU") || "уточняется"} км; номер лота: ${pairs.get("Ref. No.") || path[3].toUpperCase()}`,
    location: "Япония",
  }
}

async function fetchCarsensorListing(candidate: PublicAuctionCandidate): Promise<AuctionImportItem> {
  if (!/^AU\d+$/.test(candidate.sourceId) || candidate.sourceUrl !== `https://www.carsensor.net/usedcar/detail/${candidate.sourceId}/index.html`) throw new Error("Некорректная карточка CarSensor")
  const html = await sourceHtml("CARSENSOR", candidate.sourceUrl)
  const product = jsonLdObjects(html).find((value) => value["@type"] === "Product")
  if (!product) throw new PublicListingUnavailableError(`CarSensor: карточка ${candidate.sourceId} снята с публикации`)
  const brands = Array.isArray(product.brand) ? product.brand.map(asRecord).filter((value): value is UnknownRecord => Boolean(value)) : []
  const rawMake = asText(brands[0]?.name)
  const rawModel = asText(brands[1]?.name) || asText(product.model)
  const normalizedRawMake = rawMake?.normalize("NFKC") || null
  const make = normalizedRawMake ? normalizeAuctionMake(JAPANESE_MAKES[normalizedRawMake] || normalizedRawMake) : null
  const model = normalizeAuctionModel(rawModel ? romanizeJapanese(rawModel) : null)
  const offers = Array.isArray(product.offers) ? asRecord(product.offers[0]) : asRecord(product.offers)
  const sourcePrice = asNumber(asText(offers?.price)?.replace(/,/g, ""))
  const pairs = tablePairs(html)
  const year = pairs.get("年式(初度登録年)")?.match(/(\d{4})/)
  if (!make || !model || !sourcePrice || sourcePrice >= 999_999_999 || !year || /[\u3040-\u30FF\u3400-\u9FFF]/.test(make)) throw new Error(`CarSensor: неполная карточка ${candidate.sourceId}`)
  const carsensorImageHosts = new Set(["ccsrpcma.carsensor.net", "ccsrpcml.carsensor.net"])
  const images = [...new Set([...html.matchAll(/https:\/\/(?:ccsrpcma|ccsrpcml)\.carsensor\.net\/[^\s"')]+\.(?:jpg|jpeg|png|webp)/gi)]
    .map((match) => safeImage(match[0], carsensorImageHosts)).filter((url): url is string => Boolean(url)))].slice(0, 60)
  const mileageWan = asNumber(pairs.get("走行距離")?.match(/([\d.]+)万km/)?.[1])
  const mileageKm = mileageWan !== null ? Math.round(mileageWan * 10_000) : asNumber(pairs.get("走行距離")?.replace(/[^\d]/g, ""))
  return {
    source: "CARSENSOR", sourceId: candidate.sourceId, sourceUrl: candidate.sourceUrl,
    make, model, year: Number(year[1]), manufacturedMonth: null,
    sourcePrice: Math.round(sourcePrice), sourceCurrency: "JPY", country: "JP", auctionDate: null,
    mileage: mileageKm, fuelType: normalizeAuctionFuelType(pairs.get("使用燃料")),
    transmission: normalizeAuctionTransmission(pairs.get("ミッション")), bodyType: null,
    color: pairs.get("色") || asText(product.color), engineVolume: asNumber(pairs.get("排気量")?.replace(/[^\d.]/g, "")),
    power: null, driveType: normalizeAuctionDriveType(pairs.get("駆動方式")), vin: null, lotNumber: candidate.sourceId,
    imageUrl: images[0] || null, images,
    descriptionOrig: `${make} ${model}. Автомобиль из открытого каталога CarSensor.`,
    specsOrig: `Год выпуска: ${year[1]}; пробег: ${mileageKm?.toLocaleString("ru-RU") || "уточняется"} км; номер лота: ${candidate.sourceId}`,
    location: "Япония",
  }
}

async function fetchAutosaleListing(candidate: PublicAuctionCandidate): Promise<AuctionImportItem> {
  if (!/^\d+$/.test(candidate.sourceId) || candidate.sourceUrl !== `https://autosale.ee/listings/view.php?id=${candidate.sourceId}`) throw new Error("Некорректная карточка AutoSale")
  const html = await sourceHtml("AUTOSALE", candidate.sourceUrl)
  const car = jsonLdObjects(html).find((value) => value["@type"] === "Car")
  const offers = asRecord(car?.offers)
  if (!car || asText(offers?.availability) !== "https://schema.org/InStock") throw new PublicListingUnavailableError(`AutoSale: карточка ${candidate.sourceId} снята с публикации`)
  const make = normalizeAuctionMake(asText(asRecord(car.brand)?.name))
  const model = normalizeAuctionModel(car.model)
  const sourcePrice = asNumber(offers?.price)
  const year = asNumber(car.vehicleModelDate)
  if (!make || !model || !sourcePrice || !year) throw new Error(`AutoSale: неполная карточка ${candidate.sourceId}`)
  const imageValues = Array.isArray(car.image) ? car.image : [car.image]
  const images = [...new Set(imageValues.map(asText).map((url) => safeImage(url, new Set(["autosale.ee"]))).filter((url): url is string => Boolean(url)))].slice(0, 60)
  return {
    source: "AUTOSALE", sourceId: candidate.sourceId, sourceUrl: candidate.sourceUrl,
    make, model, year: Math.round(year), manufacturedMonth: null,
    sourcePrice: Math.round(sourcePrice), sourceCurrency: "EUR", country: "DE", auctionDate: null,
    mileage: asNumber(asRecord(car.mileageFromOdometer)?.value), fuelType: normalizeAuctionFuelType(car.fuelType),
    transmission: normalizeAuctionTransmission(car.vehicleTransmission), bodyType: normalizeAuctionBodyType(car.bodyType),
    color: asText(car.color), engineVolume: null, power: null, driveType: null, vin: null, lotNumber: candidate.sourceId,
    imageUrl: images[0] || null, images,
    descriptionOrig: `${make} ${model}. Автомобиль из открытого европейского каталога AutoSale.`,
    specsOrig: `Год выпуска: ${Math.round(year)}; пробег: ${asNumber(asRecord(car.mileageFromOdometer)?.value)?.toLocaleString("ru-RU") || "уточняется"} км; номер лота: ${candidate.sourceId}`,
    location: "Эстония",
  }
}

async function activeYouxinpaiCandidate(sourceId: string) {
  for (let page = 1; page <= publicSourceMaximumPage("YOUXINPAI"); page += 1) {
    let cached = youxinpaiCatalogCache.get(page)
    if (!cached || cached.expiresAt <= Date.now()) {
      const json = await sourceHtml("YOUXINPAI", publicSourceCatalogUrl("YOUXINPAI", page))
      parseYouxinpaiCatalog(json, page)
      cached = youxinpaiCatalogCache.get(page)
    }
    const candidate = cached?.candidates.find((value) => value.sourceId === sourceId)
    if (candidate) return candidate
  }
  return null
}

async function fetchYouxinpaiListing(candidate: PublicAuctionCandidate): Promise<AuctionImportItem> {
  if (!/^\d+$/.test(candidate.sourceId)) throw new Error("Некорректная карточка YouXinPai")
  const active = candidate.make && candidate.model && candidate.sourcePrice ? candidate : await activeYouxinpaiCandidate(candidate.sourceId)
  if (!active?.make || !active.model || !active.sourcePrice || !active.year) throw new PublicListingUnavailableError(`YouXinPai: карточка ${candidate.sourceId} снята с публикации`)
  const engineVolume = asNumber(active.model.match(/(\d+(?:\.\d+)?)\s*[LT]\b/i)?.[1])
  const images = active.imageUrl ? [active.imageUrl] : []
  return {
    source: "YOUXINPAI", sourceId: active.sourceId, sourceUrl: active.sourceUrl,
    make: active.make, model: active.model, year: active.year, manufacturedMonth: active.manufacturedMonth || null,
    sourcePrice: active.sourcePrice, sourceCurrency: "CNY", country: "CN", auctionDate: active.auctionDate || null,
    mileage: active.mileage ?? null, fuelType: active.fuelType || null, transmission: active.transmission || null,
    bodyType: active.bodyType || null, color: null, engineVolume, power: null, driveType: null, vin: null,
    lotNumber: active.sourceId, imageUrl: active.imageUrl || null, images,
    descriptionOrig: `${active.make} ${active.model}. Автомобиль опубликован в официальном экспортном аукционном каталоге YouXinPai.`,
    specsOrig: `Год выпуска: ${active.year}; пробег: ${active.mileage?.toLocaleString("ru-RU") || "уточняется"} км; номер лота: ${active.sourceId}`,
    location: "Китай",
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
  if (source === "YOUXINPAI") return fetchYouxinpaiListing(candidate)
  if (source === "GOONET") return fetchGoonetListing(candidate)
  if (source === "BEFORWARD") return fetchBeforwardListing(candidate)
  if (source === "CARSENSOR") return fetchCarsensorListing(candidate)
  if (source === "AUTOSALE") return fetchAutosaleListing(candidate)
  if (source === "BOBAEDREAM") return fetchBobaedreamListing(candidate)
  return fetchCarvagoListing(candidate)
}
