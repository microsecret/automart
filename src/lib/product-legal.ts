/**
 * Что закон требует знать о товаре — по товарной группе.
 *
 * Источники (исследование 13.10.2026, scratchpad legal/requirements.json):
 * - маркировка «Честный знак»: шины — с 2020 (решение ЕЭК № 129, ПП № 1958),
 *   масла — с 01.09.2025, проверка на кассе с 01.10.2026 (ПП № 1683);
 *   запчасти — добровольный эксперимент до 28.02.2027 (ПП № 202);
 * - подтверждение соответствия: ТР ТС 018/2011 прил. 10 (компоненты ТС),
 *   ТР ТС 030/2012 (масла и спецжидкости);
 * - сведения о товаре: ЗоЗПП ст. 10 и 26.1, правила продажи № 657;
 * - самозанятым нельзя продавать маркируемые товары (422-ФЗ, ч. 2 ст. 4).
 * Для антифризов, тормозных жидкостей и омывателей маркировка указана в
 * обзорах, но не сверена с приложением к ПП № 1683 — поэтому «уточните».
 *
 * Модуль без импортов: проверки работают и в форме, и на сервере.
 */

export type MarkingStatus = "required" | "check" | "experiment" | "none"
export type ConformityRule = { regulation: string; form: "certificate" | "declaration" | "declaration_or_certificate" }

export const CONFORMITY_TYPES = [
  { value: "CERTIFICATE", label: "Сертификат соответствия" },
  { value: "DECLARATION", label: "Декларация о соответствии" },
  { value: "NOT_REQUIRED", label: "Не подлежит обязательному подтверждению" },
] as const

const TR_018 = "ТР ТС 018/2011"
const TR_030 = "ТР ТС 030/2012"

const RULES: Readonly<Record<string, { marking: MarkingStatus; conformity?: ConformityRule; shelfLife?: boolean; note?: string }>> = {
  tires: { marking: "required", conformity: { regulation: TR_018, form: "certificate" } },
  wheels: { marking: "experiment", conformity: { regulation: TR_018, form: "certificate" } },
  engine_oil: { marking: "required", conformity: { regulation: TR_030, form: "declaration" }, shelfLife: true },
  transmission_oil: { marking: "required", conformity: { regulation: TR_030, form: "declaration" }, shelfLife: true },
  hydraulic_fluid: { marking: "check", conformity: { regulation: TR_030, form: "declaration" }, shelfLife: true },
  antifreeze: { marking: "check", conformity: { regulation: TR_030, form: "declaration" }, shelfLife: true },
  brake_fluid: { marking: "check", conformity: { regulation: TR_030, form: "declaration" }, shelfLife: true },
  washer_fluid: { marking: "check", shelfLife: true, note: "Омыватели с метанолом запрещены — только изопропиловый спирт." },
  greases: { marking: "check", shelfLife: true },
  other_fluids: { marking: "none", shelfLife: true },
  battery: { marking: "none", conformity: { regulation: TR_018, form: "declaration_or_certificate" } },
  spark_plugs: { marking: "experiment", conformity: { regulation: TR_018, form: "declaration_or_certificate" } },
  wiper_blades: { marking: "none", conformity: { regulation: TR_018, form: "declaration_or_certificate" } },
  brake_pads: { marking: "experiment", conformity: { regulation: TR_018, form: "certificate" } },
  brake_discs: { marking: "experiment", conformity: { regulation: TR_018, form: "certificate" } },
  oil_filter: { marking: "experiment", conformity: { regulation: TR_018, form: "certificate" } },
  air_filter: { marking: "experiment", conformity: { regulation: TR_018, form: "certificate" } },
  cabin_filter: { marking: "experiment", conformity: { regulation: TR_018, form: "certificate" } },
  fuel_filter: { marking: "experiment", conformity: { regulation: TR_018, form: "certificate" } },
  shock_absorbers: { marking: "none", conformity: { regulation: TR_018, form: "certificate" } },
  belts: { marking: "none", conformity: { regulation: TR_018, form: "certificate" } },
  bulbs: { marking: "none", conformity: { regulation: TR_018, form: "certificate" }, note: "Ксеноновые лампы нельзя ставить в фары, не рассчитанные на них (КоАП 12.5 ч. 3)." },
  chem_engine: { marking: "none", shelfLife: true },
  chem_additives: { marking: "none", shelfLife: true },
  chem_body: { marking: "none", shelfLife: true },
  chem_interior: { marking: "none", shelfLife: true },
  chem_repair: { marking: "none", shelfLife: true },
  autochem: { marking: "none", shelfLife: true },
  chargers: { marking: "none", note: "Сетевые устройства на 220 В подтверждают соответствие по ТР ТС 004/2011 и 020/2011." },
}

export function legalRules(group: string | null | undefined) {
  return (group && RULES[group]) || { marking: "none" as MarkingStatus }
}

/** Маркируемые группы самозанятому закрыты: он продаёт только своё изделие. */
export function forbiddenForSelfEmployed(group: string | null | undefined) {
  return legalRules(group).marking === "required"
}

/** GTIN: 8, 12, 13 или 14 цифр с верной контрольной цифрой. */
export function isValidGtin(raw: string) {
  const digits = raw.replace(/\D/g, "")
  if (![8, 12, 13, 14].includes(digits.length)) return false
  const body = digits.slice(0, -1).split("").reverse().map(Number)
  const sum = body.reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1])
}

export type LegalInput = {
  gtin?: string | null
  brandName?: string | null
  originCountry?: string | null
  conformityType?: string | null
  conformityNumber?: string | null
  condition?: string | null
}

/**
 * Проверка позиции перед публикацией: ошибки блокируют сохранение,
 * предупреждения — показываются продавцу.
 *
 * Обязательно то, без чего товар нельзя продавать по закону: штрихкод у
 * маркируемых групп и сведения о подтверждении соответствия, где оно
 * требуется. Самозанятому маркируемые группы закрыты.
 */
export function checkLegal(group: string | null | undefined, input: LegalInput, sellerType?: string | null) {
  const rules = legalRules(group)
  const errors: Record<string, string> = {}
  const warnings: string[] = []
  const isNew = input.condition !== "USED"

  if (sellerType === "SELF_EMPLOYED" && rules.marking === "required") {
    errors.productGroup = "Самозанятым закон не разрешает продавать маркируемые товары (шины, масла) — 422-ФЗ"
  }
  if (isNew && rules.marking === "required") {
    if (!input.gtin?.trim()) errors.gtin = "Маркируемый товар: укажите штрихкод (GTIN) — продавать без маркировки «Честный знак» нельзя"
    else if (!isValidGtin(input.gtin)) errors.gtin = "Штрихкод не похож на GTIN: 8, 12, 13 или 14 цифр"
  } else if (input.gtin?.trim() && !isValidGtin(input.gtin)) {
    errors.gtin = "Штрихкод не похож на GTIN: 8, 12, 13 или 14 цифр"
  }
  if (rules.marking === "check") warnings.push("Товар может подлежать маркировке «Честный знак» — уточните у поставщика и укажите штрихкод")

  if (isNew && rules.conformity) {
    const type = input.conformityType
    if (!type || type === "NOT_REQUIRED") {
      errors.conformityType = `${rules.conformity.regulation}: ${rules.conformity.form === "certificate" ? "нужен сертификат" : rules.conformity.form === "declaration" ? "нужна декларация" : "нужен сертификат или декларация"} о соответствии`
    } else if (!input.conformityNumber?.trim()) {
      errors.conformityNumber = "Номер документа из реестра ФСА"
    }
  }
  if (!input.brandName?.trim()) warnings.push("Укажите производителя — покупатель обязан знать изготовителя")
  if (!input.originCountry?.trim()) warnings.push("Укажите страну производства")
  if (rules.note) warnings.push(rules.note)
  return { errors, warnings, rules }
}

export const CONFORMITY_REGISTRY_URL = "https://pub.fsa.gov.ru/"

/** Текст о возврате для карточки — ЗоЗПП ст. 26.1. */
export const RETURN_POLICY_TEXT =
  "Товар надлежащего качества можно вернуть в течение 7 дней после получения, если сохранены его вид и потребительские свойства; если порядок возврата не передан письменно при доставке — в течение 3 месяцев. Товар с недостатком — по правилам о гарантии."

const COUNTRY_BY_CODE: Readonly<Record<string, string>> = {
  RU: "Россия", CN: "Китай", KR: "Корея", JP: "Япония", DE: "Германия", US: "США", BY: "Беларусь",
  TR: "Турция", IT: "Италия", FR: "Франция", PL: "Польша", CZ: "Чехия", IN: "Индия", TW: "Тайвань", AE: "ОАЭ",
}

/** Страна для покупателя: старые позиции хранят код (CN), новые — название. */
export function countryLabel(value: string | null | undefined) {
  if (!value) return null
  return COUNTRY_BY_CODE[value.toUpperCase()] ?? value
}

export const CONFORMITY_LABEL: Readonly<Record<string, string>> = {
  CERTIFICATE: "Сертификат соответствия",
  DECLARATION: "Декларация о соответствии",
  NOT_REQUIRED: "Не подлежит обязательному подтверждению",
}
