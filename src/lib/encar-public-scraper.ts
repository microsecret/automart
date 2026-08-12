import { isIdentifiableAuctionMake, normalizeAuctionBodyType, normalizeAuctionDriveType, normalizeAuctionFuelType, normalizeAuctionMake, normalizeAuctionTransmission } from "@/lib/auction-normalization"
import type { AuctionConditionCheck, AuctionConditionInfo, AuctionEquipmentItem, AuctionImportItem } from "@/lib/auction-import"
import { translateToRussian } from "@/lib/nvidia-translate"

const ENCAR_HOST = "fem.encar.com"
const ENCAR_DETAIL_PATH = /^\/cars\/detail\/(\d+)$/
const ENCAR_CATALOG_HOST = "car.encar.com"
const ENCAR_CATALOG_PATH = "/list/car"
const ENCAR_SEDAN_SIZE_CATEGORIES = new Set(["경차", "소형차", "준중형차", "중형차", "대형차"])
const ENCAR_COLOR_LABELS: ReadonlyArray<readonly [string, string]> = [
  ["은회색", "серебристо-серый"], ["담녹색", "тёмно-зелёный"], ["진주색", "жемчужный"], ["쥐색", "мышино-серый"],
  ["검정색", "чёрный"], ["은색", "серебристый"], ["흰색", "белый"], ["회색", "серый"],
  ["빨간색", "красный"], ["파란색", "синий"], ["청색", "синий"], ["남색", "тёмно-синий"],
  ["갈색", "коричневый"], ["베이지색", "бежевый"], ["초록색", "зелёный"], ["녹색", "зелёный"],
  ["노란색", "жёлтый"], ["주황색", "оранжевый"], ["보라색", "фиолетовый"], ["금색", "золотистый"],
]
const ENCAR_LOCATION_LABELS: ReadonlyArray<readonly [string, string]> = [
  ["전북특별자치도", "пров. Чолла-Пукто"], ["전라북도", "пров. Чолла-Пукто"], ["전남특별자치도", "пров. Чолла-Намдо"], ["전라남도", "пров. Чолла-Намдо"],
  ["경기도", "пров. Кёнгидо"], ["강원특별자치도", "пров. Канвондо"], ["강원도", "пров. Канвондо"], ["충청북도", "пров. Чхунчхон-Пукто"], ["충청남도", "пров. Чхунчхон-Намдо"],
  ["경상북도", "пров. Кёнсан-Пукто"], ["경상남도", "пров. Кёнсан-Намдо"], ["제주특별자치도", "Чеджу"],
  ["서울특별시", "Сеул"], ["부산광역시", "Пусан"], ["대구광역시", "Тэгу"], ["인천광역시", "Инчхон"], ["광주광역시", "Кванджу"], ["대전광역시", "Тэджон"], ["울산광역시", "Ульсан"], ["세종특별자치시", "Седжон"],
  ["전북", "пров. Чолла-Пукто"], ["전남", "пров. Чолла-Намдо"], ["충북", "пров. Чхунчхон-Пукто"], ["충남", "пров. Чхунчхон-Намдо"], ["경북", "пров. Кёнсан-Пукто"], ["경남", "пров. Кёнсан-Намдо"], ["경기", "пров. Кёнгидо"], ["서울", "Сеул"], ["인천", "Инчхон"], ["부산", "Пусан"], ["대구", "Тэгу"], ["대전", "Тэджон"], ["광주", "Кванджу"], ["울산", "Ульсан"], ["제주", "Чеджу"],
  ["전주시", "Чонджу"], ["수원시", "Сувон"], ["성남시", "Соннам"], ["용인시", "Ёнин"], ["고양시", "Коян"], ["화성시", "Хвасон"], ["부천시", "Пучхон"], ["안산시", "Ансан"], ["평택시", "Пхёнтхэк"], ["김포시", "Кимпхо"], ["파주시", "Пхаджу"],
  ["권선구", "район Квонсон"], ["권선로", "ул. Квонсон-ро"],
  ["금정구", "район Кымджон"], ["덕진구", "район Токчин"], ["강서구", "район Кансо"], ["서구", "район Со"], ["반송로", "ул. Бансона-ро"], ["온고을로", "ул. Онгыль-ро"],
]
const ENCAR_PRIMARY_OPTION_LABELS: Readonly<Record<string, string>> = {
  "선루프": "Люк",
  "헤드램프 (HID)": "Фары HID",
  "주차감지센서": "Парктроники",
  "후방카메라": "Камера заднего вида",
  "자동에어컨": "Климат-контроль",
  "스마트키": "Бесключевой доступ",
  "내비게이션": "Навигация",
  "열선시트": "Подогрев сидений",
  "통풍시트": "Вентиляция сидений",
  "가죽시트": "Кожаный салон",
}

type UnknownRecord = Record<string, unknown>

/** A source-confirmed absence is safe to use for expiry decisions. */
export class EncarListingUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EncarListingUnavailableError"
  }
}

export function isEncarListingUnavailableError(error: unknown): error is EncarListingUnavailableError {
  return error instanceof EncarListingUnavailableError
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

function firstPositiveInteger(...values: unknown[]) {
  for (const value of values) {
    const parsed = asInteger(value)
    if (parsed && parsed > 0) return parsed
  }
  return null
}

function asYearMonth(value: unknown) {
  const match = asText(value)?.match(/^(\d{4})(0[1-9]|1[0-2])$/)
  return match ? `${match[1]}-${match[2]}` : null
}

function sourceUrlFrom(value: unknown) {
  if (typeof value !== "string") throw new Error("Нужна ссылка на публичную карточку Encar")
  const url = new URL(value)
  const match = url.hostname === ENCAR_HOST && url.protocol === "https:" ? url.pathname.match(ENCAR_DETAIL_PATH) : null
  if (!match) throw new Error("Поддерживаются только ссылки вида fem.encar.com/cars/detail/{id}")
  return { sourceUrl: `${url.origin}${url.pathname}`, requestedId: match[1] }
}

function catalogUrlFrom(value: unknown) {
  const url = value == null || value === "" ? new URL("https://car.encar.com/list/car?page=1") : new URL(String(value))
  if (url.protocol !== "https:" || url.hostname !== ENCAR_CATALOG_HOST || url.pathname !== ENCAR_CATALOG_PATH) {
    throw new Error("Поддерживаются только публичные страницы car.encar.com/list/car")
  }
  return url.toString()
}

/** Safely extracts the JSON assigned to Encar's public, server-rendered state. */
function extractPreloadedState(html: string): UnknownRecord {
  const marker = "__PRELOADED_STATE__ = "
  const markerIndex = html.indexOf(marker)
  if (markerIndex < 0) throw new Error("Публичная карточка Encar не содержит данных автомобиля")

  const start = html.indexOf("{", markerIndex + marker.length)
  if (start < 0) throw new Error("Не удалось найти данные автомобиля Encar")

  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < html.length; index += 1) {
    const character = html[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === "\\") escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') {
      inString = true
      continue
    }
    if (character === "{") depth += 1
    if (character === "}") {
      depth -= 1
      if (depth === 0) {
        const state = asRecord(JSON.parse(html.slice(start, index + 1)))
        if (!state) break
        return state
      }
    }
  }

  throw new Error("Данные Encar повреждены или имеют неизвестный формат")
}

function photoUrl(photo: unknown) {
  const path = asText(asRecord(photo)?.path)
  // Encar's raw link is a 640px preview. Its public CDN accepts this image
  // policy and returns a 1600px rendition for the detail gallery.
  return path?.startsWith("/carpicture")
    ? `https://ci.encar.com/carpicture${path}?impolicy=heightRate&rh=1024&cw=1600&ch=1024&cg=Center`
    : null
}

function normalizeEncarBodyType(value: unknown) {
  const body = normalizeAuctionBodyType(value)
  if (body) return body
  // Encar denotes sedan-class passenger cars by size, while SUVs and vans
  // use their own body labels. Preserve an unknown value instead of guessing.
  return typeof value === "string" && ENCAR_SEDAN_SIZE_CATEGORIES.has(value.trim()) ? "SEDAN" : null
}

function translateEncarColor(value: string | null) {
  if (!value) return null
  return ENCAR_COLOR_LABELS.reduce((translated, [source, russian]) => translated.replace(source, russian), value)
}

const HANGUL_INITIAL_RU = ["г", "кк", "н", "д", "тт", "р", "м", "б", "пп", "с", "сс", "", "ч", "чч", "ч", "к", "т", "п", "х"]
const HANGUL_VOWEL_RU = ["а", "э", "я", "яэ", "о", "е", "ё", "е", "о", "ва", "вэ", "ве", "ё", "у", "во", "ве", "ви", "ю", "ы", "уи", "и"]
const HANGUL_FINAL_RU = ["", "к", "к", "к", "н", "н", "н", "т", "ль", "к", "м", "ль", "ль", "ль", "ль", "ль", "м", "п", "п", "т", "т", "нг", "т", "т", "к", "т", "п", "т"]

function transliterateHangul(value: string) {
  return value.replace(/[\uAC00-\uD7AF]/g, (syllable) => {
    const offset = syllable.charCodeAt(0) - 0xac00
    const initial = Math.floor(offset / 588)
    const vowel = Math.floor((offset % 588) / 28)
    const final = offset % 28
    return `${HANGUL_INITIAL_RU[initial]}${HANGUL_VOWEL_RU[vowel]}${HANGUL_FINAL_RU[final]}`
  })
}

function transliterateKoreanPlaceName(value: string) {
  const transliterated = transliterateHangul(value)
  return transliterated ? `${transliterated[0].toUpperCase()}${transliterated.slice(1)}` : transliterated
}

function translateKnownEncarLocation(value: string) {
  const known = ENCAR_LOCATION_LABELS.reduce((translated, [source, russian]) => translated.replaceAll(source, russian), value)
  // Keep structured Korean address suffixes readable when the exact district
  // or street is not part of the deterministic dictionary. Transliteration is
  // still used for the name itself, but the result no longer looks like an
  // untranslated concatenation such as "данвонгу пунгчонро".
  const structured = known
    .replace(/([\uAC00-\uD7AF]+)구(?=\s|$)/g, (_, district: string) => `район ${transliterateKoreanPlaceName(district)}`)
    .replace(/([\uAC00-\uD7AF]+)동(?=\s|$)/g, (_, neighborhood: string) => `квартал ${transliterateKoreanPlaceName(neighborhood)}`)
    .replace(/([\uAC00-\uD7AF]+)로(?=\s|$)/g, (_, street: string) => `ул. ${transliterateKoreanPlaceName(street)}-ро`)
    .replace(/([\uAC00-\uD7AF]+)길(?=\s|$)/g, (_, lane: string) => `пер. ${transliterateKoreanPlaceName(lane)}-гиль`)
  return /[\uAC00-\uD7AF]/.test(structured) ? transliterateHangul(structured) : structured
}

function isUnreliableLocationTranslation(source: string, translated: string) {
  return translated.trim() === source.trim()
    || /[\uAC00-\uD7AF]/.test(translated)
    || /(?:это\s+(?:не\s+)?автомобильный\s+текст|корейский\s+текст|перевод(?:ится|\s+на\s+русский)|не\s+требуется)/i.test(translated)
}

async function translateEncarLocation(value: string | null) {
  if (!value) return null
  const deterministic = translateKnownEncarLocation(value)
  // Korean addresses are structured data. When all of their parts are known,
  // do not send them to an LLM: deterministic labels avoid explanatory prose
  // being stored in a location field.
  if (!/[\uAC00-\uD7AF]/.test(deterministic)) return deterministic
  const translated = await translateToRussian(value)
  return isUnreliableLocationTranslation(value, translated) ? deterministic : translated
}

/**
 * The public Encar page renders its primary equipment as accessible list
 * items. The state only carries option IDs, so parse the source-rendered
 * labels and their explicit present/absent flag instead of guessing by trim.
 */
function extractEncarPrimaryEquipment(html: string): AuctionEquipmentItem[] {
  const sectionStart = html.indexOf("주요옵션")
  const listEnd = sectionStart < 0 ? -1 : html.indexOf("</ul>", sectionStart)
  if (sectionStart < 0 || listEnd < 0) return []

  const section = html.slice(sectionStart, listEnd + "</ul>".length)
  return Array.from(section.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)).flatMap((match) => {
    const text = match[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim()
    const status = text.match(/\s+(있음|없음)$/)
    if (!status) return []
    const sourceLabel = text.slice(0, -status[0].length).trim()
    const label = ENCAR_PRIMARY_OPTION_LABELS[sourceLabel]
    // Never display an untranslated equipment name as if it were Russian.
    return label ? [{ label, available: status[1] === "있음" }] : []
  })
}

function sourceHtmlText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function sourceButtonText(html: string, eventName: string) {
  const escapedName = eventName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = html.match(new RegExp(`<button[^>]*data-enlog-dt-eventname="${escapedName}"[^>]*>([\\s\\S]*?)<\\/button>`))
  return match ? sourceHtmlText(match[1]) : null
}

/**
 * Encar renders two high-level checks in the public page. Keep them separate
 * from a damage report: neither one gives a repair percentage or a list of
 * replaced panels. Only show the exact positive checks published by Encar.
 */
function extractEncarVerifiedConditionItems(html: string): AuctionConditionCheck[] {
  const checks: AuctionConditionCheck[] = []
  const buttons = Array.from(html.matchAll(/<button[^>]*data-enlog-dt-eventnamegroup="엔카진단"[^>]*>([\s\S]*?)<\/button>/g))
    .map((match) => sourceHtmlText(match[1]))

  if (buttons.some((text) => text.includes("프레임") && text.includes("무사고 확인"))) {
    checks.push({ label: "Силовой каркас", status: "ДТП не выявлено" })
  }
  if (buttons.some((text) => text.includes("내외부") && text.includes("차량 관리 상태 확인"))) {
    checks.push({ label: "Внешнее и внутреннее состояние", status: "Проверено Encar" })
  }

  return checks
}

function extractEncarConditionInfo(html: string): AuctionConditionInfo | null {
  const insuranceText = sourceButtonText(html, "보험이력")
  const inspectionText = sourceButtonText(html, "성능점검내역")
  const comparisonIndex = html.indexOf("신차대비")
  const comparisonSection = comparisonIndex < 0 ? "" : html.slice(comparisonIndex, comparisonIndex + 1_500)
  const insuranceRecordCount = Number(insuranceText?.match(/(\d+)\s*건/)?.[1])
  // Only accept the number rendered in Encar's visible comparison gauge.
  // URL-encoded links in the same block can contain sequences such as %22.
  const comparisonGauge = comparisonSection.match(/<span[^>]*class="[^"]*num_graph[^"]*"[^>]*>\s*(\d{1,3}|-)\s*%\s*<\/span>/)
  const newCarPriceRatioPct = Number(comparisonGauge?.[1])
  const inspectionSummary = inspectionText?.includes("일반")
    ? inspectionText.includes("엔카직영") ? "Общая проверка · Encar Direct" : "Общая проверка"
    : null
  const verifiedItems = extractEncarVerifiedConditionItems(html)
  const result = {
    insuranceRecordCount: Number.isInteger(insuranceRecordCount) ? insuranceRecordCount : null,
    inspectionSummary,
    newCarPriceRatioPct: Number.isInteger(newCarPriceRatioPct) && newCarPriceRatioPct >= 0 && newCarPriceRatioPct <= 100 ? newCarPriceRatioPct : null,
    verifiedItems,
  }
  return result.insuranceRecordCount !== null || result.inspectionSummary || result.newCarPriceRatioPct !== null || result.verifiedItems.length ? result : null
}

/** Extracts deduplicated public detail links from one Encar catalogue page. */
export async function discoverEncarPublicListingUrls(rawUrl: unknown, limit: number) {
  const catalogUrl = catalogUrlFrom(rawUrl)
  const response = await fetch(catalogUrl, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
      "User-Agent": "AutoMarket-Importer/1.0",
    },
  })
  if (!response.ok) throw new Error(`Encar вернул HTTP ${response.status}`)
  if (new URL(response.url).hostname !== ENCAR_CATALOG_HOST) throw new Error("Encar перенаправил каталог на неподдерживаемый адрес")

  const html = await response.text()
  if (html.length > 2_000_000) throw new Error("Страница каталога Encar превышает допустимый размер")

  const urls = new Set<string>()
  const matcher = /https:\/\/fem\.encar\.com\/cars\/detail\/(\d+)/g
  for (const match of html.matchAll(matcher)) {
    urls.add(`https://${ENCAR_HOST}/cars/detail/${match[1]}`)
    if (urls.size >= limit) break
  }
  if (!urls.size) throw new Error("В публичной выдаче Encar не найдены ссылки на автомобили")
  return [...urls]
}

export async function scrapeEncarPublicListing(rawUrl: unknown): Promise<AuctionImportItem> {
  const { sourceUrl, requestedId } = sourceUrlFrom(rawUrl)
  const response = await fetch(sourceUrl, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
      "User-Agent": "AutoMarket-Importer/1.0",
    },
  })
  if (response.status === 404 || response.status === 410) {
    throw new EncarListingUnavailableError(`Лот Encar больше недоступен (HTTP ${response.status})`)
  }
  if (!response.ok) throw new Error(`Encar вернул HTTP ${response.status}`)
  if (new URL(response.url).hostname !== ENCAR_HOST) throw new Error("Encar перенаправил запрос на неподдерживаемый адрес")

  const html = await response.text()
  if (html.length > 1_500_000) throw new Error("Карточка Encar превышает допустимый размер")

  const state = extractPreloadedState(html)
  const cars = asRecord(state.cars)
  const base = asRecord(cars?.base)
  const category = asRecord(base?.category)
  const advertisement = asRecord(base?.advertisement)
  const spec = asRecord(base?.spec)
  const contact = asRecord(base?.contact)
  if (!base || !category || !advertisement || !spec) throw new Error("В карточке Encar отсутствуют обязательные данные автомобиля")

  const vehicleId = asInteger(base.vehicleId)
  const queryCarId = asInteger(base.queryCarId) || asInteger(asRecord(base.manage)?.dummyVehicleId)
  // Encar's catalogue uses its public advertisement ID, while the detail
  // payload stores a different physical vehicle ID. Accept that documented
  // relation only when the payload explicitly confirms the requested ID.
  if (!vehicleId || !queryCarId || String(queryCarId) !== requestedId) {
    throw new EncarListingUnavailableError("Публичный ID Encar больше не подтверждён данными карточки")
  }

  const manufacturedMonth = asYearMonth(category.yearMonth)
  const year = manufacturedMonth ? Number.parseInt(manufacturedMonth.slice(0, 4), 10) : asInteger(category.formYear)
  const listedPrice = asInteger(advertisement.price)
  const make = normalizeAuctionMake(asText(category.manufacturerEnglishName) || asText(category.manufacturerName))
  const modelParts = [
    asText(category.modelGroupEnglishName) || asText(category.modelGroupName) || asText(category.modelEnglishName) || asText(category.modelName),
    asText(category.gradeEnglishName) || asText(category.gradeName),
    asText(category.gradeDetailEnglishName) || asText(category.gradeDetailName),
  ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)
  if (!make || !isIdentifiableAuctionMake(make) || !modelParts.length || year === null || year < 1886 || year > new Date().getFullYear() + 1 || !listedPrice || listedPrice < 1) {
    throw new Error("В карточке Encar нет корректных марки, модели, года или цены")
  }

  const photos = Array.isArray(base.photos)
    ? Array.from(new Set(base.photos
        .slice()
        .sort((left, right) => Number(asText(asRecord(right)?.code) === "001") - Number(asText(asRecord(left)?.code) === "001"))
        .map(photoUrl)
        .filter((url): url is string => Boolean(url))
      ))
    : []
  const equipmentCodes = asRecord(base.options)?.standard
  const equipment = extractEncarPrimaryEquipment(html)
  const equipmentTotal = Array.isArray(equipmentCodes) ? equipmentCodes.length : null
  const conditionInfo = extractEncarConditionInfo(html)

  const rawBody = asText(spec.bodyName)
  const rawFuel = asText(spec.fuelName)
  const rawTransmission = asText(spec.transmissionName)
  const rawDrive = asText(spec.driveName)
  const rawColor = asText(spec.colorName)
  const originalSpecs = [rawBody, rawFuel, rawTransmission, rawDrive, rawColor].filter(Boolean).join(" · ") || null

  return {
    source: "ENCAR",
    sourceId: requestedId,
    sourceUrl,
    make,
    model: modelParts.join(" "),
    year,
    manufacturedMonth,
    sourcePrice: listedPrice * 10_000,
    sourceCurrency: "KRW",
    country: "KR",
    auctionDate: null,
    mileage: asInteger(spec.mileage),
    fuelType: normalizeAuctionFuelType(rawFuel),
    transmission: normalizeAuctionTransmission(rawTransmission),
    bodyType: normalizeEncarBodyType(rawBody),
    color: translateEncarColor(rawColor),
    engineVolume: (() => {
      const displacement = asInteger(spec.displacement)
      return displacement && displacement > 0 ? Number((displacement / 1000).toFixed(1)) : null
    })(),
    // Some Encar records include power in a source field, while many public
    // listings omit it entirely. Never infer horsepower from displacement.
    power: firstPositiveInteger(spec.power, spec.horsePower, spec.horsepower, spec.ps, base.power, base.horsePower),
    driveType: normalizeAuctionDriveType(rawDrive),
    vin: asText(base.vin),
    lotNumber: requestedId,
    imageUrl: photos[0] || null,
    images: photos.length ? photos : null,
    descriptionOrig: asText(advertisement.oneLineText),
    specsOrig: originalSpecs,
    equipment: equipment.length ? { totalReported: equipmentTotal && equipmentTotal >= equipment.length ? equipmentTotal : equipment.length, items: equipment } : null,
    conditionInfo,
    location: await translateEncarLocation(asText(contact?.address)),
  }
}
