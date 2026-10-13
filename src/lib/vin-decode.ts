/**
 * Расшифровка VIN по открытому стандарту ISO 3779: код завода (WMI,
 * первые три знака) и модельный год (десятый знак).
 *
 * Это не каталог производителя: модель, двигатель и комплектация в VIN
 * закодированы по-своему у каждой марки, и эти таблицы — лицензируемые
 * данные. Поэтому здесь только то, что стандарт делает общим: страна,
 * марка по коду завода и год. Остальное человек уточняет сам, а мы честно
 * говорим, что определили.
 */

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/

/* Коды заводов. Сначала ищется три знака, затем два — для производителей,
   у которых третий знак означает тип кузова или завод (1G1, 1G6...). */
const WMI_BRANDS: Readonly<Record<string, string>> = {
  // Европа
  WVW: "Volkswagen", WV1: "Volkswagen", WV2: "Volkswagen", WVG: "Volkswagen", XW8: "Volkswagen",
  WAU: "Audi", WA1: "Audi", TRU: "Audi",
  WBA: "BMW", WBS: "BMW", WBY: "BMW", WBX: "BMW", X4X: "BMW",
  WDB: "Mercedes-Benz", WDD: "Mercedes-Benz", WDC: "Mercedes-Benz", W1K: "Mercedes-Benz", W1N: "Mercedes-Benz", W1V: "Mercedes-Benz", WDF: "Mercedes-Benz",
  WP0: "Porsche", WP1: "Porsche",
  W0L: "Opel", W0V: "Opel",
  WF0: "Ford",
  TMB: "Skoda", VSS: "SEAT",
  VF1: "Renault", X7L: "Renault",
  VF3: "Peugeot", VF7: "Citroen",
  ZFA: "Fiat", ZAR: "Alfa Romeo", ZFF: "Ferrari", ZHW: "Lamborghini", ZAM: "Maserati",
  YV1: "Volvo", YV4: "Volvo",
  SAL: "Land Rover", SAJ: "Jaguar", SCF: "Aston Martin", SCB: "Bentley",
  // Япония
  JTD: "Toyota", JTE: "Toyota", JTM: "Toyota", JTN: "Toyota", JTK: "Toyota", JT2: "Toyota", JT3: "Toyota",
  JTH: "Lexus", JTJ: "Lexus",
  JHM: "Honda", JHL: "Honda", JH4: "Acura",
  JN1: "Nissan", JN8: "Nissan", JNK: "Infiniti",
  JM1: "Mazda", JM3: "Mazda", JMZ: "Mazda",
  JF1: "Subaru", JF2: "Subaru",
  JS1: "Suzuki", JS2: "Suzuki", JS3: "Suzuki", TSM: "Suzuki",
  JA3: "Mitsubishi", JA4: "Mitsubishi", JMB: "Mitsubishi", JMY: "Mitsubishi",
  JDA: "Daihatsu",
  // Корея
  KMH: "Hyundai", KM8: "Hyundai", Z94: "Hyundai", "5NP": "Hyundai", "5NM": "Hyundai",
  KNA: "Kia", KNB: "Kia", KNC: "Kia", KND: "Kia", "5XY": "Kia", "3KP": "Kia",
  KPT: "SsangYong",
  // США, Канада, Мексика
  "1G1": "Chevrolet", "1GC": "Chevrolet", "1GN": "Chevrolet", "2G1": "Chevrolet",
  "1GT": "GMC", "1GK": "GMC", "1G6": "Cadillac", "1GY": "Cadillac", "1G4": "Buick",
  "1FA": "Ford", "1FM": "Ford", "1FT": "Ford", "2FM": "Ford", "3FA": "Ford", Z6F: "Ford",
  "1LN": "Lincoln",
  "1J4": "Jeep", "1J8": "Jeep", "1C4": "Jeep", "1C6": "Ram", "1C3": "Chrysler", "2C3": "Chrysler",
  "1B3": "Dodge", "2B3": "Dodge",
  "5YJ": "Tesla", "7SA": "Tesla", LRW: "Tesla",
  "4T1": "Toyota", "5TD": "Toyota", "5TF": "Toyota", "2T1": "Toyota",
  "1HG": "Honda", "2HG": "Honda", "5FN": "Honda", "5J6": "Honda",
  "1N4": "Nissan", "1N6": "Nissan", "5N1": "Nissan", "3N1": "Nissan",
  "5UX": "BMW", "5YM": "BMW", "4JG": "Mercedes-Benz", "3VW": "Volkswagen", "1VW": "Volkswagen",
  "4S3": "Subaru", "4S4": "Subaru",
  // Китай
  LSV: "Volkswagen", LFV: "Volkswagen",
  LVS: "Ford", LVV: "Chery",
  LC0: "BYD", LGX: "BYD",
  LB3: "Geely", L6T: "Geely",
  LGW: "Haval",
  LS5: "Changan",
  LTV: "Toyota", LBV: "BMW", LE4: "Mercedes-Benz",
  LJ1: "JAC", LSJ: "MG", LSG: "Chevrolet", LHG: "Honda", LVH: "Honda",
  LMG: "GAC", LNB: "BAIC", LFP: "FAW",
  // Россия и СНГ
  XTA: "Lada (ВАЗ)", XTT: "УАЗ", X96: "ГАЗ", XTC: "КАМАЗ",
}

const REGION_BY_FIRST: Array<[RegExp, string]> = [
  [/^[A-H]/, "Африка"],
  [/^[J]/, "Япония"],
  [/^K[L-R]/, "Корея"],
  [/^[K]/, "Азия"],
  [/^[L]/, "Китай"],
  [/^[M-R]/, "Азия"],
  [/^S/, "Великобритания"],
  [/^T/, "Европа"],
  [/^V[F-R]/, "Франция или Испания"],
  [/^V/, "Европа"],
  [/^W/, "Германия"],
  [/^X[3-9]|^X[A-Z]/, "Россия"],
  [/^Y/, "Северная Европа"],
  [/^Z[A-R]/, "Италия"],
  [/^Z/, "Европа"],
  [/^[1-5]/, "Северная Америка"],
  [/^[6-7]/, "Океания"],
  [/^[8-9]/, "Южная Америка"],
]

/* Десятый знак: цикл в 30 лет. A=1980/2010, …, Y=2000/2030, 1=2001/2031, … 9=2009/2039. */
const YEAR_CODES = "ABCDEFGHJKLMNPRSTVWXY123456789"

export type VinDecodeResult =
  | { valid: false; reason: string }
  | {
      valid: true
      vin: string
      wmi: string
      brand: string | null
      region: string | null
      modelYear: number | null
      /** Контрольная цифра сходится — значит, VIN набран без опечатки. */
      checkDigitOk: boolean | null
    }

const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
}
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]

function checkDigit(vin: string) {
  let sum = 0
  for (let index = 0; index < 17; index += 1) {
    const char = vin[index]
    const value = /\d/.test(char) ? Number(char) : TRANSLIT[char]
    sum += value * WEIGHTS[index]
  }
  const remainder = sum % 11
  return remainder === 10 ? "X" : String(remainder)
}

/* Кириллица, похожая на латиницу: VIN часто набирают на русской раскладке
   или переписывают с СТС. */
const CYRILLIC_LOOKALIKE: Record<string, string> = {
  А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", Р: "P", С: "C", Т: "T", Х: "X", У: "Y",
}

export function normalizeVin(raw: string) {
  return raw
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[АВЕКМНРСТХУ]/g, (char) => CYRILLIC_LOOKALIKE[char] ?? char)
    /* I, O и Q в VIN запрещены именно потому, что их путают с 1 и 0. */
    .replace(/[OQО]/g, "0")
    .replace(/[IІ]/g, "1")
}

export function looksLikeVin(raw: string) {
  return VIN_PATTERN.test(normalizeVin(raw))
}

export function decodeVin(raw: string, now = new Date()): VinDecodeResult {
  const vin = normalizeVin(raw)
  if (vin.length !== 17) return { valid: false, reason: "VIN состоит из 17 знаков" }
  if (!VIN_PATTERN.test(vin)) return { valid: false, reason: "В VIN только латиница и цифры, без букв I, O и Q" }

  const wmi = vin.slice(0, 3)
  const brand = WMI_BRANDS[wmi] ?? null
  const region = REGION_BY_FIRST.find(([pattern]) => pattern.test(vin))?.[1] ?? null

  const yearIndex = YEAR_CODES.indexOf(vin[9])
  let modelYear: number | null = null
  if (yearIndex >= 0) {
    /* Из двух лет цикла берётся последний, который уже наступил (с учётом
       модельного года, начинающегося раньше календарного). */
    const latestAllowed = now.getFullYear() + 1
    const candidates = [1980 + yearIndex, 2010 + yearIndex, 2040 + yearIndex].filter((year) => year <= latestAllowed)
    modelYear = candidates.length ? candidates[candidates.length - 1] : null
  }

  /* Контрольная цифра обязательна для Северной Америки и Китая; у
     европейских марок девятый знак часто произвольный — там её не судим. */
  const mandatoryCheck = /^[1-5L]/.test(vin)
  const checkDigitOk = mandatoryCheck ? checkDigit(vin) === vin[8] : null

  return { valid: true, vin, wmi, brand, region, modelYear, checkDigitOk }
}
