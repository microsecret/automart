export const AUCTION_BODY_TYPES = ["SEDAN", "SUV", "HATCHBACK", "COUPE", "PICKUP", "WAGON", "MINIVAN"] as const

const AUCTION_MAKE_ALIASES: Readonly<Record<string, string>> = {
  ChevroletGMDaewoo: "Chevrolet / GM Daewoo",
  "쉐보레GM대우": "Chevrolet / GM Daewoo",
  KG_Mobility_Ssangyong: "KGM / SsangYong",
  "KG Mobility Ssangyong": "KGM / SsangYong",
  "Renault-KoreaSamsung": "Renault Korea Motors",
  "Renault Korea Samsung": "Renault Korea Motors",
  "르노코리아삼성": "Renault Korea Motors",
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
  ELECTRIC: ["ELECTRIC", "EV", "전기", "전기차", "纯电", "电动"],
  HYBRID: ["HYBRID", "HEV", "PHEV", "하이브리드", "플러그인 하이브리드", "가솔린+전기", "가솔린 + 전기", "전기+가솔린", "混动", "插电混动"],
  GAS: ["GAS", "LPG", "LPG(일반인 구입)", "LPG (일반인 구입)", "CNG", "LNG", "가스", "액화석유가스", "天然气"],
}

const transmissionAliases: Record<string, readonly string[]> = {
  AUTOMATIC: ["AUTOMATIC", "AUTO", "AT", "A/T", "오토", "自动"],
  MANUAL: ["MANUAL", "MT", "M/T", "수동", "手动"],
  VARIATOR: ["VARIATOR", "CVT", "무단변속", "无级"],
  ROBOTIC: ["ROBOTIC", "DCT", "DSG", "ROBOT", "듀얼클러치", "双离合"],
}

const driveAliases: Record<string, readonly string[]> = {
  FWD: ["FWD", "2WD FRONT", "전륜", "전륜구동", "前驱"],
  RWD: ["RWD", "2WD REAR", "후륜", "后驱"],
  AWD: ["AWD", "4WD", "4X4", "사륜", "四驱", "全轮"],
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
