/**
 * ИИ-перевод текста на русский через NVIDIA API.
 * Ротация 5 ключей при rate limit (429).
 */

const KEYS = (process.env.NVIDIA_KEYS || "").split(",").filter(Boolean)
let currentKeyIdx = 0

function getNextKey(): string | null {
  if (KEYS.length === 0) return null
  const key = KEYS[currentKeyIdx % KEYS.length]
  currentKeyIdx++
  return key
}

// Простой кэш (in-memory, для одного процесса)
const cache = new Map<string, string>()
const MAX_TRANSLATION_CACHE_ENTRIES = 1_000

function rememberTranslation(source: string, translated: string) {
  if (!cache.has(source) && cache.size >= MAX_TRANSLATION_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined
    if (oldest) cache.delete(oldest)
  }
  cache.set(source, translated)
}

export async function translateToRussian(text: string): Promise<string> {
  if (!text || text.trim().length === 0) return text
  if (cache.has(text)) return cache.get(text)!

  // Если уже кириллица — не переводим
  if (/[\u0400-\u04FF]/.test(text) && !/[\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(text)) {
    return text
  }

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
          model: "nvidia/llama-3.1-nemotron-70b-instruct",
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

      if (!res.ok) {
        const errText = await res.text().catch(() => "unknown")
        lastError = new Error(`NVIDIA API ${res.status}: ${errText}`)
        continue
      }

      const data = await res.json()
      const translated = data?.choices?.[0]?.message?.content?.trim()

      if (translated && translated.length > 0) {
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
  const [descriptionRu, specsRu] = await Promise.all([
    fields.description ? translateToRussian(fields.description) : Promise.resolve(null),
    fields.specs ? translateToRussian(fields.specs) : Promise.resolve(null),
  ])
  return { descriptionRu, specsRu }
}
