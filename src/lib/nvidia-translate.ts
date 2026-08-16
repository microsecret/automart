/**
 * ИИ-перевод текста на русский через NVIDIA API.
 * Ротация ключей применяется только при rate limit (429). Ошибка авторизации
 * ставит короткую паузу, чтобы импорт не создавал лишний трафик и шум в логах.
 */

const KEYS = (process.env.NVIDIA_KEYS || "").split(",").map((key) => key.trim()).filter(Boolean)
const NVIDIA_MODEL = process.env.NVIDIA_MODEL?.trim() || "meta/llama-3.1-70b-instruct"
const AUTH_FAILURE_COOLDOWN_MS = 5 * 60 * 1000
let currentKeyIdx = 0
let authUnavailableUntil = 0

function getNextKey(): string | null {
  if (KEYS.length === 0) return null
  const key = KEYS[currentKeyIdx % KEYS.length]
  currentKeyIdx++
  return key
}

// Простой кэш (in-memory, для одного процесса)
const cache = new Map<string, string>()
const MAX_TRANSLATION_CACHE_ENTRIES = 1_000
const EAST_ASIAN_SCRIPT = /[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/
const CYRILLIC_SCRIPT = /[\u0400-\u04FF]/

const KOREAN_AUTOMOTIVE_FALLBACKS: ReadonlyArray<readonly [RegExp, string]> = [
  // Exact compounds must precede short automotive terms (`은색`, `금색`)
  // to avoid storing a mixed Korean/Russian result after provider fallback.
  [/명은색/g, "ярко-серебристый"],
  [/연금색/g, "светло-золотистый"],
  [/청옥색/g, "бирюзовый"],
  [/신차 출고 후 1인이 운행 차량 입니다~/g, "С момента выдачи нового автомобиля эксплуатировался одним владельцем."],
  [/도색도없음/g, "Без окрасов"],
  [/렌트이력없음/g, "Без истории аренды"],
  [/신차1억900/g, "Цена нового автомобиля по данным источника: 109 млн ₩"],
  [/20인치휠/g, "20-дюймовые колёса"],
  [/하이테크/g, "пакет Hi-Tech"],
  [/엔카진단/g, "Диагностика Encar"],
  [/정비완료/g, "Обслуживание выполнено"],
  [/할부대차OK/g, "Возможны кредит и трейд-ин"],
  [/신차와 동일/g, "Как новый"],
  [/전국최저가/g, "Заявлена минимальная цена по стране"],
  [/중형차/g, "седан среднего класса"],
  [/대형차/g, "седан представительского класса"],
  [/준중형차/g, "седан компактного класса"],
  [/소형차/g, "компактный автомобиль"],
  [/경차/g, "малолитражный автомобиль"],
  [/디젤/g, "дизель"],
  [/가솔린/g, "бензин"],
  [/하이브리드/g, "гибрид"],
  [/전기차|전기/g, "электро"],
  [/오토/g, "АКПП"],
  [/수동/g, "МКПП"],
  [/검정색/g, "чёрный"],
  [/은색/g, "серебристый"],
  [/흰색/g, "белый"],
  [/회색/g, "серый"],
  [/사륜구동|사륜/g, "полный привод"],
  [/전륜구동|전륜/g, "передний привод"],
  [/후륜구동|후륜/g, "задний привод"],
]

function rememberTranslation(source: string, translated: string) {
  if (!cache.has(source) && cache.size >= MAX_TRANSLATION_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined
    if (oldest) cache.delete(oldest)
  }
  cache.set(source, translated)
}

function translateKnownKoreanAutomotiveTerms(text: string) {
  return KOREAN_AUTOMOTIVE_FALLBACKS.reduce((translated, [pattern, replacement]) => translated.replace(pattern, replacement), text)
}

export async function translateToRussian(text: string): Promise<string> {
  if (!text || text.trim().length === 0) return text
  if (cache.has(text)) return cache.get(text)!

  // Если уже кириллица — не переводим
  if (/[\u0400-\u04FF]/.test(text) && !/[\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(text)) {
    return text
  }

  if (Date.now() < authUnavailableUntil) return text

  const maxRetries = KEYS.length || 1
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const apiKey = getNextKey()
    if (!apiKey) {
      lastError = new Error("No NVIDIA API keys configured")
      break
    }

    try {
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: NVIDIA_MODEL,
          messages: [
            {
              role: "system",
              content: "You are a professional automotive translator. Translate the given text to Russian. Keep technical terms, car brands, and model names recognizable. Output ONLY the translation, no explanations.",
            },
            { role: "user", content: text },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      })

      if (res.status === 429) {
        // Rate limit — следующий ключ
        continue
      }

      if (res.status === 401 || res.status === 403) {
        // An invalid or revoked credential cannot be solved by cycling all
        // configured keys. Cool down, keep importing, and use the local
        // terminology fallback until the operator fixes the secret.
        authUnavailableUntil = Date.now() + AUTH_FAILURE_COOLDOWN_MS
        lastError = new Error(`NVIDIA API ${res.status}: authorization failed`)
        break
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "unknown")
        lastError = new Error(`NVIDIA API ${res.status}: ${errText}`)
        if (res.status >= 400 && res.status < 500) break
        continue
      }

      const data = await res.json()
      const translated = data?.choices?.[0]?.message?.content?.trim()

      if (translated && translated.length > 0) {
        if (EAST_ASIAN_SCRIPT.test(text) && (EAST_ASIAN_SCRIPT.test(translated) || !CYRILLIC_SCRIPT.test(translated))) {
          lastError = new Error("Translation provider returned untranslated source script")
          continue
        }
        rememberTranslation(text, translated)
        return translated
      }

      lastError = new Error("Empty translation response")
    } catch (err) {
      lastError = err as Error
    }
  }

  console.error("Translation failed:", lastError?.message)
  return text // fallback — вернуть оригинал
}

/** Перевести несколько полей оптом */
export async function translateListingFields(fields: {
  description?: string | null
  specs?: string | null
}): Promise<{ descriptionRu: string | null; specsRu: string | null }> {
  const translateField = async (value: string | null | undefined) => {
    if (!value) return null
    const translated = await translateToRussian(value)
    // A provider/network failure deliberately returns the original. For Encar's
    // common Korean technical fields, show a deterministic Russian fallback
    // rather than storing the original as a successful translation.
    const candidate = translated.trim() === value.trim() && /[\uAC00-\uD7AF]/.test(value)
      ? translateKnownKoreanAutomotiveTerms(value)
      : translated
    // Customer pages are Russian-only. A failed or partial provider response
    // is retained in descriptionOrig/specsOrig and can be retried later, but
    // is never published as a successful translation.
    if (EAST_ASIAN_SCRIPT.test(candidate)) return null
    if (/[A-Za-z]/.test(value) && candidate.trim() === value.trim() && !CYRILLIC_SCRIPT.test(candidate)) return null
    return candidate
  }
  const [descriptionRu, specsRu] = await Promise.all([
    translateField(fields.description),
    translateField(fields.specs),
  ])
  return { descriptionRu, specsRu }
}
