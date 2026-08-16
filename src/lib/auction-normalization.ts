export const AUCTION_BODY_TYPES = ["SEDAN", "SUV", "HATCHBACK", "COUPE", "PICKUP", "WAGON", "MINIVAN"] as const

const AUCTION_MAKE_ALIASES: Readonly<Record<string, string>> = {
  "현대": "Hyundai",
  "기아": "Kia",
  "제네시스": "Genesis",
  "르노코리아": "Renault Korea Motors",
  "르노삼성": "Renault Korea Motors",
  "KG모빌리티": "KGM / SsangYong",
  "쌍용": "KGM / SsangYong",
  "쉐보레": "Chevrolet",
  "쉐보레(GM대우)": "Chevrolet / GM Daewoo",
  "한국GM": "Chevrolet / GM Korea",
  "아우디": "Audi",
  "폭스바겐": "Volkswagen",
  "메르세데스-벤츠": "Mercedes-Benz",
  "벤츠": "Mercedes-Benz",
  "비엠더블유": "BMW",
  "볼보": "Volvo",
  "포르쉐": "Porsche",
  "랜드로버": "Land Rover",
  "렉서스": "Lexus",
  "토요타": "Toyota",
  "혼다": "Honda",
  "닛산": "Nissan",
  "미니": "MINI",
  "포드": "Ford",
  "지프": "Jeep",
  "푸조": "Peugeot",
  "테슬라": "Tesla",
  ChevroletGMDaewoo: "Chevrolet / GM Daewoo",
  "쉐보레GM대우": "Chevrolet / GM Daewoo",
  KG_Mobility_Ssangyong: "KGM / SsangYong",
  "KG Mobility Ssangyong": "KGM / SsangYong",
  "Renault-KoreaSamsung": "Renault Korea Motors",
  "Renault Korea Samsung": "Renault Korea Motors",
  "르노코리아삼성": "Renault Korea Motors",
  "르노코리아(삼성)": "Renault Korea Motors",
  "吉利汽车": "Geely",
  "奇瑞汽车": "Chery",
  "长城汽车": "Great Wall",
  "长安汽车": "Changan",
  "比亚迪": "BYD",
  "红旗": "Hongqi",
  "理想汽车": "Li Auto",
  "理想": "Li Auto",
  "极氪": "Zeekr",
  "岚图": "Voyah",
  "零跑汽车": "Leapmotor",
  "零跑": "Leapmotor",
  "广汽": "GAC",
  "蔚来": "Nio",
  "小鹏汽车": "Xpeng",
  "小鹏": "Xpeng",
  "阿维塔": "Avatr",
  "问界": "Aito",
  "腾势": "Denza",
  "欧拉": "Ora",
  "魏牌": "Wey",
  "荣威": "Roewe",
  "小米汽车": "Xiaomi Auto",
  "五菱汽车": "Wuling",
}

const UNIDENTIFIABLE_AUCTION_MAKES = new Set([
  "others",
  "other",
  "unknown",
  "etc",
  "기타",
])

/** Turns provider-specific manufacturer keys into a readable public label. */
export function normalizeAuctionMake(value: unknown) {
  if (typeof value !== "string") return null
  const make = value.trim().replace(/\s+/g, " ")
  return make ? AUCTION_MAKE_ALIASES[make] || make : null
}

/** A generic provider bucket is not enough to present a trustworthy vehicle. */
export function isIdentifiableAuctionMake(value: unknown) {
  const make = normalizeAuctionMake(value)
  return Boolean(make && !UNIDENTIFIABLE_AUCTION_MAKES.has(make.toLocaleLowerCase("en-US")))
}

/** Public-facing label for old records imported before normalisation existed. */
export function auctionMakeLabel(value: string) {
  return normalizeAuctionMake(value) || value.replace(/_/g, " ")
}

const EAST_ASIAN_SCRIPT = /[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/
const LATIN_SCRIPT = /[A-Za-z]/
const CYRILLIC_SCRIPT = /[\u0400-\u04FF]/

const KOREAN_MODEL_TERMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/디 올 뉴/gi, "The All-New"], [/올 뉴/gi, "All-New"], [/더 뉴/gi, "The New"], [/뉴/gi, "New"],
  [/아이오닉/gi, "Ioniq"], [/캐스퍼/gi, "Casper"], [/그랜저/gi, "Grandeur"], [/팰리세이드/gi, "Palisade"],
  [/트래버스/gi, "Traverse"], [/모닝/gi, "Morning"], [/어반/gi, "Urban"], [/쏘렌토/gi, "Sorento"],
  [/싼타페/gi, "Santa Fe"], [/카니발/gi, "Carnival"], [/아반떼/gi, "Avante"], [/쏘나타/gi, "Sonata"],
  [/투싼/gi, "Tucson"], [/스포티지/gi, "Sportage"], [/셀토스/gi, "Seltos"], [/니로/gi, "Niro"],
  [/스타리아/gi, "Staria"], [/스타렉스/gi, "Starex"], [/포터/gi, "Porter"], [/봉고/gi, "Bongo"],
  [/레이/gi, "Ray"], [/스파크/gi, "Spark"], [/말리부/gi, "Malibu"], [/트랙스/gi, "Trax"],
  [/크루즈/gi, "Cruze"], [/콜로라도/gi, "Colorado"], [/이쿼녹스/gi, "Equinox"], [/임팔라/gi, "Impala"],
  [/올란도/gi, "Orlando"], [/티볼리/gi, "Tivoli"], [/토레스/gi, "Torres"], [/렉스턴/gi, "Rexton"],
  [/코란도/gi, "Korando"], [/액티언/gi, "Actyon"], [/무쏘/gi, "Musso"], [/체어맨/gi, "Chairman"],
  [/클래스/gi, "Class"], [/하이브리드/gi, "Hybrid"], [/(\d+)세대/gi, "$1-е поколение"], [/페이스리프트/gi, "рестайлинг"],
]

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

/** Customer-facing model label without Korean/Japanese/Chinese script. */
export function normalizeAuctionModel(value: unknown) {
  if (typeof value !== "string") return null
  let model = value.trim()
  if (!model) return null
  for (const [pattern, replacement] of KOREAN_MODEL_TERMS) model = model.replace(pattern, replacement)
  model = transliterateHangul(model).replace(/\s+/g, " ").trim()
  return model && !EAST_ASIAN_SCRIPT.test(model) ? model : null
}

/** Prevents a failed machine translation from leaking source script into UI. */
export function isCustomerFacingRussianText(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim() || EAST_ASIAN_SCRIPT.test(value)) return false
  // Codes and numbers are language-neutral. Any prose written with Latin
  // letters must also contain a Russian explanation before it is published.
  return !LATIN_SCRIPT.test(value) || CYRILLIC_SCRIPT.test(value)
}

/** Auction import storage uses cubic centimetres for every combustion engine. */
export function normalizeAuctionEngineVolumeCc(value: unknown, fuelType: string | null | undefined) {
  if (fuelType === "ELECTRIC") return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  const cubicCentimetres = parsed <= 10 ? parsed * 1_000 : parsed
  return Math.round(cubicCentimetres)
}

const bodyAliases: Record<(typeof AUCTION_BODY_TYPES)[number], readonly string[]> = {
  SEDAN: ["SEDAN", "SALOON", "BERLINE", "세단", "轿车", "三厢"],
  SUV: ["SUV", "CUV", "JEEP", "SPORT UTILITY", "CROSSOVER", "지프", "越野", "越野车"],
  HATCHBACK: ["HATCHBACK", "HATCH", "해치백", "两厢"],
  COUPE: ["COUPE", "쿠페", "跑车"],
  PICKUP: ["PICKUP", "PICK-UP", "TRUCK", "픽업", "皮卡"],
  WAGON: ["WAGON", "ESTATE", "STATION WAGON", "UNIVERSAL", "왜건", "универсал", "旅行车"],
  MINIVAN: ["MINIVAN", "MINI VAN", "VAN", "MPV", "MINIBUS", "RV", "미니밴", "승합", "승합차", "面包车", "商务车"],
}

const fuelAliases: Record<string, readonly string[]> = {
  GASOLINE: ["GASOLINE", "PETROL", "BENZINE", "가솔린", "휘발유", "汽油"],
  DIESEL: ["DIESEL", "디젤", "경유", "柴油"],
  ELECTRIC: ["ELECTRIC", "ELECTRICITY", "EV", "전기", "전기차", "纯电", "电动"],
  HYBRID: ["HYBRID", "HYBRID_DIESEL", "HYBRID_PETROL", "PLUGIN_HYBRID", "HEV", "PHEV", "하이브리드", "플러그인 하이브리드", "가솔린+전기", "가솔린 + 전기", "전기+가솔린", "混动", "插电混动"],
  GAS: ["GAS", "LPG", "LPG(일반인 구입)", "LPG (일반인 구입)", "CNG", "LNG", "가스", "액화석유가스", "天然气"],
}

const transmissionAliases: Record<string, readonly string[]> = {
  AUTOMATIC: ["AUTOMATIC", "AUTOMATIC_GEAR", "AUTO", "AT", "A/T", "오토", "自动"],
  MANUAL: ["MANUAL", "MANUAL_GEAR", "MT", "M/T", "수동", "手动"],
  VARIATOR: ["VARIATOR", "CVT", "무단변속", "无级"],
  ROBOTIC: ["ROBOTIC", "SEMIAUTOMATIC_GEAR", "DCT", "DSG", "ROBOT", "듀얼클러치", "双离合"],
}

const driveAliases: Record<string, readonly string[]> = {
  FWD: ["FWD", "FRONT", "2WD FRONT", "전륜", "전륜구동", "前驱"],
  RWD: ["RWD", "REAR", "2WD REAR", "후륜", "后驱"],
  AWD: ["AWD", "ALL_WHEEL", "FOUR_WHEEL_DRIVE", "4WD", "4X4", "사륜", "四驱", "全轮"],
}

function normalizedAlias(value: string) {
  return value.trim().toLocaleUpperCase().replace(/\s+/g, " ")
}

function normalizeAlias(value: unknown, aliases: Record<string, readonly string[]>) {
  if (typeof value !== "string") return null
  const normalized = normalizedAlias(value)
  if (!normalized) return null
  return Object.entries(aliases).find(([, candidates]) => candidates.some((candidate) => normalized === normalizedAlias(candidate)))?.[0] || null
}

/** Returns a canonical body type only when the source value is recognised. */
export function normalizeAuctionBodyType(value: unknown) {
  return normalizeAlias(value, bodyAliases)
}

export function normalizeAuctionFuelType(value: unknown) {
  return normalizeAlias(value, fuelAliases)
}

export function normalizeAuctionTransmission(value: unknown) {
  return normalizeAlias(value, transmissionAliases)
}

export function normalizeAuctionDriveType(value: unknown) {
  return normalizeAlias(value, driveAliases)
}
