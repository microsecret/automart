export const CONTACT_REASON_CODES = [
  "PHONE",
  "EMAIL",
  "LINK",
  "MESSENGER",
  "SOCIAL_HANDLE",
] as const

export type ContactReasonCode = (typeof CONTACT_REASON_CODES)[number]

export type ContactPolicyResult = {
  allowed: boolean
  reasonCodes: ContactReasonCode[]
}

const PHONE_PATTERN = /(?:\+?\d[\s()./\\\-–—·•\p{So}]*){10,15}/u
const EMAIL_PATTERN = /[\p{L}\d._%+-]+@[\p{L}\d.-]+\.[\p{L}]{2,}/iu
const OBFUSCATED_EMAIL_PATTERN = /[\p{L}\d._-]+\s*(?:@|\(?\s*собак[аиу]?\s*\)?|\[?\s*at\s*\]?)\s*[\p{L}\d.-]+\s*(?:\.|\(?\s*точк[аиу]?\s*\)?|\[?\s*dot\s*\]?)\s*[\p{L}]{2,}/iu
const LINK_PATTERN = /(?:https?:\/\/|www\.|(?:t|wa)\.me\/|[\p{L}\d-]+\.(?:ru|рф|com|net|org|io|me|app)(?:\/|\b))/iu
const MESSENGER_PATTERN = /\b(?:telegram|t[eе]l[eе]g[rг][aа]m|телеграм(?:м|е|а)?|телега|whatsapp|wh[aа]ts[aа]pp|ватсап|вотсап|viber|вайбер|signal|сигнал)\b/iu
const SOCIAL_HANDLE_PATTERN = /(?:^|\s)@[a-z\d_]{5,}\b/iu

const DIGIT_WORDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?<![\p{L}\p{N}_])(?:ноль|нуль|zero)(?![\p{L}\p{N}_])/giu, "0"],
  [/(?<![\p{L}\p{N}_])(?:один|одна|one)(?![\p{L}\p{N}_])/giu, "1"],
  [/(?<![\p{L}\p{N}_])(?:два|две|two)(?![\p{L}\p{N}_])/giu, "2"],
  [/(?<![\p{L}\p{N}_])(?:три|three)(?![\p{L}\p{N}_])/giu, "3"],
  [/(?<![\p{L}\p{N}_])(?:четыре|four)(?![\p{L}\p{N}_])/giu, "4"],
  [/(?<![\p{L}\p{N}_])(?:пять|five)(?![\p{L}\p{N}_])/giu, "5"],
  [/(?<![\p{L}\p{N}_])(?:шесть|six)(?![\p{L}\p{N}_])/giu, "6"],
  [/(?<![\p{L}\p{N}_])(?:семь|seven)(?![\p{L}\p{N}_])/giu, "7"],
  [/(?<![\p{L}\p{N}_])(?:восемь|eight)(?![\p{L}\p{N}_])/giu, "8"],
  [/(?<![\p{L}\p{N}_])(?:девять|nine)(?![\p{L}\p{N}_])/giu, "9"],
]

const UNICODE_DECIMAL_ZERO_POINTS = [
  0x0660, // Arabic-Indic
  0x06f0, // Eastern Arabic-Indic
  0x0966, // Devanagari
] as const

function normalizeUnicodeDigits(value: string) {
  return value.replace(/\p{Nd}/gu, (digit) => {
    const codePoint = digit.codePointAt(0)
    if (codePoint === undefined) return digit
    for (const zero of UNICODE_DECIMAL_ZERO_POINTS) {
      if (codePoint >= zero && codePoint <= zero + 9) return String(codePoint - zero)
    }
    return digit
  })
}

function normalizeDigitWords(value: string) {
  const visible = normalizeUnicodeDigits(value.normalize("NFKC").replace(/[\p{Cf}\u034f\u20e3\ufe0f]/gu, ""))
  return DIGIT_WORDS.reduce((normalized, [pattern, digit]) => normalized.replace(pattern, digit), visible)
}

/**
 * Deterministic, fail-closed policy for the protected deal chat. It runs
 * before any optional AI review so an unavailable provider cannot allow an
 * obvious phone, email, link or messenger handle through.
 */
export function inspectContactSharing(content: string): ContactPolicyResult {
  const normalized = normalizeDigitWords(content)
  const reasonCodes: ContactReasonCode[] = []

  if (PHONE_PATTERN.test(normalized)) reasonCodes.push("PHONE")
  if (EMAIL_PATTERN.test(normalized) || OBFUSCATED_EMAIL_PATTERN.test(normalized)) reasonCodes.push("EMAIL")
  if (LINK_PATTERN.test(normalized)) reasonCodes.push("LINK")
  if (MESSENGER_PATTERN.test(normalized)) reasonCodes.push("MESSENGER")
  if (SOCIAL_HANDLE_PATTERN.test(normalized)) reasonCodes.push("SOCIAL_HANDLE")

  return { allowed: reasonCodes.length === 0, reasonCodes: [...new Set(reasonCodes)] }
}

export function contactPolicyMessage(reasonCodes: readonly ContactReasonCode[]) {
  const labels: Record<ContactReasonCode, string> = {
    PHONE: "номер телефона",
    EMAIL: "адрес электронной почты",
    LINK: "ссылку на внешний сайт",
    MESSENGER: "контакт в мессенджере",
    SOCIAL_HANDLE: "имя пользователя в соцсети",
  }
  const blocked = reasonCodes.map((reason) => labels[reason]).join(", ")
  return `Сообщение не отправлено: обнаружен ${blocked || "внешний контакт"}. Общайтесь и обменивайтесь документами только внутри защищённой сделки.`
}

/** Never persists the rejected text or a reversible fragment of it. */
export function moderationAuditSummary(content: string) {
  const symbols = Array.from(content).length
  return `Содержимое не сохранено · ${symbols} ${symbols === 1 ? "символ" : symbols >= 2 && symbols <= 4 ? "символа" : "символов"}`
}
