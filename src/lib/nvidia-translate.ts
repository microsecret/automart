/**
 * ИИ-перевод текста на русский через NVIDIA API.
 *
 * Ключи ротируются при rate limit (429) и при отказе авторизации: один
 * отозванный ключ из набора не должен останавливать перевод, пока остальные
 * рабочие. Пауза включается только когда авторизацию отвергли все ключи.
 */

import { parseProxyList, proxyJsonPost, type ProxyEndpoint } from "@/lib/proxy-fetch"

const KEYS = (process.env.NVIDIA_KEYS || "").split(",").map((key) => key.trim()).filter(Boolean)
const API_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

// Провайдер отвечает 451 на запросы из региона сервера, поэтому обращения
// идут через прокси. Список перебирается по кругу: один недоступный адрес не
// должен останавливать перевод, пока остальные отвечают.
const PROXIES = parseProxyList(process.env.NVIDIA_PROXIES)
let proxyCursor = 0

function nextProxy(): ProxyEndpoint | null {
  if (!PROXIES.length) return null
  const proxy = PROXIES[proxyCursor % PROXIES.length]
  proxyCursor += 1
  return proxy
}

/**
 * Отправляет запрос к провайдеру: через прокси, если он настроен, иначе
 * напрямую. Прямой путь оставлен, чтобы окружение без блокировки работало
 * без лишнего звена.
 */
async function requestCompletion(apiKey: string, body: string) {
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }
  const proxy = nextProxy()
  if (!proxy) {
    const response = await fetch(API_URL, {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
      headers,
      body,
    })
    return { status: response.status, ok: response.ok, text: () => response.text(), json: () => response.json() }
  }

  const response = await proxyJsonPost(API_URL, proxy, { headers, body, timeoutMs: 30_000 })
  return {
    status: response.status,
    ok: response.ok,
    text: async () => response.text,
    json: async () => JSON.parse(response.text),
  }
}
const NVIDIA_MODEL = process.env.NVIDIA_MODEL?.trim() || "meta/llama-3.1-70b-instruct"
const AUTH_FAILURE_COOLDOWN_MS = 5 * 60 * 1000
const RATE_LIMIT_BACKOFF_MS = 1_200
// Ключ, отвергнутый провайдером, пропускается до конца жизни процесса:
// отозванный ключ сам не восстановится, а повторные попытки создают лишний
// трафик и шум в логах на каждом импортируемом лоте.
const revokedKeys = new Set<string>()
let currentKeyIdx = 0
let authUnavailableUntil = 0

function getNextKey(): string | null {
  if (KEYS.length === 0) return null
  // Перебираем не больше одного полного круга, чтобы не зациклиться, когда
  // отозваны все ключи.
  for (let offset = 0; offset < KEYS.length; offset++) {
    const key = KEYS[currentKeyIdx % KEYS.length]
    currentKeyIdx++
    if (!revokedKeys.has(key)) return key
  }
  return null
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

/**
 * Названия моделей переводятся отдельным указанием.
 *
 * Обычная подсказка просит перевести текст, и провайдер пересказывал название
 * фразой: «5-й серии 530Li 2022 года выпуска 2.0T автоматическая коробка»
 * вместо «5 Series 530Li 2022 2.0T». В каталоге такое название не помещается
 * в карточку и не совпадает с поисковым запросом.
 */
const MODEL_PROMPT = "You normalize car model names. Return the model designation only: keep the series name in Latin script, trim engine and gearbox wording to short technical tokens, and never write a sentence. Example: «5系 530Li 2022款 2.0T 自动» -> «5 Series 530Li 2022 2.0T AT». Output ONLY the name."

export async function translateModelName(text: string): Promise<string> {
  return translateToRussian(text, MODEL_PROMPT)
}

/**
 * Читает перевод из базы.
 *
 * Отказ хранилища не должен останавливать импорт: при ошибке возвращается
 * null, и текст уходит на перевод как раньше.
 */
async function readStoredTranslation(key: string): Promise<string | null> {
  try {
    const { prisma } = await import("@/lib/prisma")
    const row = await prisma.translationCache.findUnique({ where: { key }, select: { translated: true } })
    if (!row) return null
    // Счётчик обращений показывает, какие переводы реально нужны, и не
    // задерживает импорт: результат уже получен.
    void prisma.translationCache.update({ where: { key }, data: { hits: { increment: 1 } } }).catch(() => undefined)
    return row.translated
  } catch {
    return null
  }
}

/** Сохраняет перевод, не задерживая вызывающий код. */
async function storeTranslation(key: string, sourceText: string, translated: string, mode: string) {
  try {
    const { prisma } = await import("@/lib/prisma")
    await prisma.translationCache.upsert({
      where: { key },
      update: { translated, updatedAt: new Date() },
      create: { key, sourceText: sourceText.slice(0, 2_000), translated, mode },
    })
  } catch {
    // Кэш — ускорение, а не источник истины: перевод уже отдан вызывающему.
  }
}

export async function translateToRussian(text: string, systemPrompt?: string): Promise<string> {
  if (!text || text.trim().length === 0) return text
  // Ключ кэша учитывает режим: одно название в двух режимах даёт разный
  // результат, а общий ключ вернул бы чужой перевод.
  const cacheKey = systemPrompt ? `model:${text}` : text
  if (cache.has(cacheKey)) return cache.get(cacheKey)!

  // Второй уровень кэша — база. Память живёт до перезапуска, и после деплоя
  // сборщик переводил те же названия заново: через прокси это десятки секунд
  // на строку.
  const stored = await readStoredTranslation(cacheKey)
  if (stored) {
    rememberTranslation(cacheKey, stored)
    return stored
  }

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
      const res = await requestCompletion(apiKey, JSON.stringify({
          model: NVIDIA_MODEL,
          messages: [
            {
              role: "system",
              content: systemPrompt || "You are a professional automotive translator. Translate the given text to Russian. Keep technical terms, car brands, and model names recognizable. Output ONLY the translation, no explanations.",
            },
            { role: "user", content: text },
          ],
          temperature: 0.3,
          max_tokens: 2000,
      }))

      if (res.status === 429) {
        // Rate limit — пробуем следующий ключ. Причина запоминается: если
        // лимит вернут все ключи, в логе должно быть видно именно это, а не
        // пустое «undefined».
        lastError = new Error("NVIDIA API 429: rate limit on every key")
        // Короткая пауза перед следующим ключом: без неё импорт пробегает по
        // всем ключам за миллисекунды и упирается в тот же лимит.
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_BACKOFF_MS))
        continue
      }

      if (res.status === 401 || res.status === 403) {
        // Отозван конкретный ключ, а не доступ целиком: остальные ключи из
        // набора продолжают работать, поэтому прерывать перевод нельзя.
        // Раньше первый же отозванный ключ отключал перевод на пять минут,
        // и лоты сохранялись с непереведённым исходным текстом.
        revokedKeys.add(apiKey)
        lastError = new Error(`NVIDIA API ${res.status}: authorization failed`)
        if (revokedKeys.size >= KEYS.length) {
          // Рабочих ключей не осталось — только теперь имеет смысл пауза.
          authUnavailableUntil = Date.now() + AUTH_FAILURE_COOLDOWN_MS
          break
        }
        continue
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
        rememberTranslation(cacheKey, translated)
        void storeTranslation(cacheKey, text, translated, systemPrompt ? "model" : "text")
        return translated
      }

      lastError = new Error("Empty translation response")
    } catch (err) {
      lastError = err as Error
    }
  }

  console.error("Translation failed:", lastError?.message || "провайдер не вернул перевод и не сообщил причину")
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
  // Поля переводятся последовательно: параллельная пара удваивает частоту
  // запросов, а при импорте партии лотов это упирается в лимит провайдера и
  // возвращает 429 по всем ключам сразу.
  const descriptionRu = await translateField(fields.description)
  const specsRu = await translateField(fields.specs)
  return { descriptionRu, specsRu }
}
