import { normalizeAuctionBodyType, normalizeAuctionDriveType, normalizeAuctionFuelType, normalizeAuctionTransmission } from "@/lib/auction-normalization"
import type { AuctionImportItem } from "@/lib/auction-import"

const ENCAR_HOST = "fem.encar.com"
const ENCAR_DETAIL_PATH = /^\/cars\/detail\/(\d+)$/
const ENCAR_CATALOG_HOST = "car.encar.com"
const ENCAR_CATALOG_PATH = "/list/car"
const ENCAR_SEDAN_SIZE_CATEGORIES = new Set(["경차", "소형차", "준중형차", "중형차", "대형차"])
const ENCAR_COLOR_LABELS: ReadonlyArray<readonly [string, string]> = [
  ["검정색", "чёрный"], ["은색", "серебристый"], ["흰색", "белый"], ["회색", "серый"],
  ["빨간색", "красный"], ["파란색", "синий"], ["갈색", "коричневый"], ["베이지색", "бежевый"],
  ["초록색", "зелёный"], ["노란색", "жёлтый"], ["주황색", "оранжевый"], ["보라색", "фиолетовый"],
]
const ENCAR_LOCATION_LABELS: ReadonlyArray<readonly [string, string]> = [
  ["경기", "пров. Кёнгидо"], ["서울", "Сеул"], ["인천", "Инчхон"], ["부산", "Пусан"], ["대구", "Тэгу"], ["대전", "Тэджон"], ["광주", "Кванджу"], ["울산", "Ульсан"], ["제주", "Чеджу"],
  ["수원시", "Сувон"], ["성남시", "Соннам"], ["용인시", "Ёнин"], ["고양시", "Коян"], ["화성시", "Хвасон"], ["부천시", "Пучхон"], ["안산시", "Ансан"], ["평택시", "Пхёнтхэк"], ["김포시", "Кимпхо"], ["파주시", "Пхаджу"],
  ["권선구", "район Квонсон"], ["권선로", "ул. Квонсон-ро"],
]

type UnknownRecord = Record<string, unknown>

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

function translateEncarLocation(value: string | null) {
  if (!value) return null
  return ENCAR_LOCATION_LABELS.reduce((translated, [source, russian]) => translated.replace(source, russian), value)
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
    throw new Error("Публичный ID Encar не подтверждён данными карточки")
  }

  const manufacturedMonth = asYearMonth(category.yearMonth)
  const year = manufacturedMonth ? Number.parseInt(manufacturedMonth.slice(0, 4), 10) : asInteger(category.formYear)
  const listedPrice = asInteger(advertisement.price)
  const make = asText(category.manufacturerEnglishName) || asText(category.manufacturerName)
  const modelParts = [
    asText(category.modelGroupEnglishName) || asText(category.modelGroupName) || asText(category.modelEnglishName) || asText(category.modelName),
    asText(category.gradeEnglishName) || asText(category.gradeName),
    asText(category.gradeDetailEnglishName) || asText(category.gradeDetailName),
  ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index)
  if (!make || !modelParts.length || year === null || year < 1886 || year > new Date().getFullYear() + 1 || !listedPrice || listedPrice < 1) {
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
    power: asInteger(spec.power),
    driveType: normalizeAuctionDriveType(rawDrive),
    vin: asText(base.vin),
    lotNumber: requestedId,
    imageUrl: photos[0] || null,
    images: photos.length ? photos : null,
    descriptionOrig: asText(advertisement.oneLineText),
    specsOrig: originalSpecs,
    location: translateEncarLocation(asText(contact?.address)),
  }
}
