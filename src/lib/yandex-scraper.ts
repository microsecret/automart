import { chromium, type Browser } from "playwright-core"
import { normalizeQueue, parseYandexSnippet } from "@/lib/yandex-snippet"
import { resolveTargetRegions } from "@/lib/fuel-target-regions"
import { createFuelImportRun, finishFuelImportRun, upsertImportedStations, type ImportedStation } from "@/lib/fuel-import-store"

/**
 * Сбор АЗС из Яндекс Карт.
 *
 * Единственный источник, который знает про очередь на заправке: в выдаче
 * рядом с названием стоит «92, 95, ДТ · Нет очереди». Ни цены, ни отметки
 * водителей этого не дают — очередь видна только тому, кто сейчас на
 * месте, и Яндекс собирает её с навигатора.
 *
 * Работает через браузер, а не через запрос к API. Так вышло не по
 * выбору: внутренний поиск карт отвечает на прямой запрос новым
 * CSRF-токеном вместо данных, а в разметке первой страницы лежит пять
 * точек из сотни — остальные догружаются скриптом при прокрутке списка.
 * Проверено на живых Картах: без браузера набирается одна точка на
 * запрос, с браузером — тридцать за пятнадцать секунд.
 *
 * Поэтому пакет взят `playwright-core`, без встроенных браузеров: на
 * сервере Chromium уже стоит, и тянуть вторую копию в веб-приложение
 * незачем.
 */

const SEARCH_QUERY = "АЗС"

type YandexSnippet = {
  id: string | null
  title: string | null
  longitude: number
  latitude: number
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

const DEFAULT_PAUSE_MS = 1_000

/* Список подгружается порциями при прокрутке. Шесть проходов доводят
   выдачу до предела, который Яндекс отдаёт на один запрос, — дальше он
   просто перестаёт добавлять. */
const SCROLL_ROUNDS = 6
const SCROLL_PAUSE_MS = 1_200
const PAGE_TIMEOUT_MS = 50_000

/* Браузер один на весь прогон: запуск занимает около секунды, и на
   двенадцати регионах это заметно. */
let sharedBrowser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (sharedBrowser?.isConnected()) return sharedBrowser
  sharedBrowser = await chromium.launch({
    /* Путь к системному Chromium: `playwright-core` своих браузеров не
       возит, а на сервере он уже стоит для соседних задач. */
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  })
  return sharedBrowser
}

async function closeBrowser() {
  if (!sharedBrowser) return
  await sharedBrowser.close().catch(() => undefined)
  sharedBrowser = null
}

/** Читает выдачу Яндекса по одному прямоугольнику. */
async function collectRegionSnippets(browser: Browser, center: { lon: number; lat: number }, zoom: number): Promise<YandexSnippet[]> {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  })
  /* Признак автоматизации Яндекс проверяет: без этой правки страница
     уходит на заглушку «обновите браузер». */
  await context.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => undefined }))

  try {
    const page = await context.newPage()
    const url = `https://yandex.ru/maps/search/${encodeURIComponent(SEARCH_QUERY)}/?ll=${center.lon.toFixed(6)}%2C${center.lat.toFixed(6)}&z=${zoom}`
    await page.goto(url, { waitUntil: "networkidle", timeout: PAGE_TIMEOUT_MS })
    await page.waitForTimeout(3_000)

    for (let round = 0; round < SCROLL_ROUNDS; round += 1) {
      await page.evaluate(() => {
        const list = document.querySelector(".search-list-view__list")
        if (list) list.scrollBy(0, 3_000)
      })
      await page.waitForTimeout(SCROLL_PAUSE_MS)
    }

    return await page.evaluate(() => {
      const result: Array<{ id: string | null; title: string | null; longitude: number; latitude: number }> = []
      for (const element of document.querySelectorAll("[data-coordinates]")) {
        const parts = (element.getAttribute("data-coordinates") || "").split(",")
        if (parts.length !== 2) continue
        const longitude = Number(parts[0])
        const latitude = Number(parts[1])
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue
        result.push({
          id: element.getAttribute("data-id"),
          title: element.querySelector("[class*=title]")?.textContent?.trim() ?? null,
          longitude,
          latitude,
        })
      }
      return result
    })
  } finally {
    await context.close().catch(() => undefined)
  }
}

function normalizeSnippet(snippet: YandexSnippet, city: string): ImportedStation | null {
  if (snippet.latitude < 41 || snippet.latitude > 82) return null
  if (snippet.longitude < 19 || snippet.longitude > 190) return null

  const parsed = parseYandexSnippet(snippet.title)
  const queue = normalizeQueue(parsed.queue)

  return {
    source: "YANDEX",
    sourceId: asText(snippet.id) ?? `${snippet.latitude.toFixed(6)}:${snippet.longitude.toFixed(6)}`,
    name: parsed.name,
    brand: parsed.name,
    address: null,
    city,
    latitude: snippet.latitude,
    longitude: snippet.longitude,
    /* Наличие Яндекс не знает — он знает ассортимент и очередь. Ставить
       здесь «есть» по факту существования колонки нельзя: это была бы
       выдумка, а карта показывает наличие как проверенный факт. */
    status: null,
    fuelsNow: parsed.fuels.length ? parsed.fuels.join(",") : null,
    dtOnly: parsed.fuels.length === 1 && parsed.fuels[0] === "DT",
    prices: [],
    queueNote: queue,
  }
}

export type YandexCollectOptions = {
  regionKeys?: string[]
  pauseMs?: number
}

export type YandexCollectResult = {
  runId: string | null
  status: "SUCCEEDED" | "PARTIAL" | "FAILED"
  regions: Array<{ key: string; city: string; fetched: number; saved: number; error: string | null }>
  fetched: number
  saved: number
  failed: number
  message: string | null
}

export async function collectYandex(options: YandexCollectOptions = {}): Promise<YandexCollectResult> {
  const pauseMs = options.pauseMs ?? DEFAULT_PAUSE_MS
  const regions = resolveTargetRegions(options.regionKeys)
  const run = await createFuelImportRun("YANDEX", regions.length)

  const regionResults: YandexCollectResult["regions"] = []
  let fetchedTotal = 0
  let savedTotal = 0
  let failedTotal = 0

  try {
    const browser = await getBrowser()

    for (const region of regions) {
      let fetched = 0
      let saved = 0
      let error: string | null = null

      try {
        const center = { lon: (region.lon1 + region.lon2) / 2, lat: (region.lat1 + region.lat2) / 2 }
        /* Масштаб от размера прямоугольника: у города берётся крупный, у
           области — мелкий, иначе выдача уходит в один квартал. */
        const span = Math.max(region.lat2 - region.lat1, region.lon2 - region.lon1)
        const zoom = span > 4 ? 8 : span > 1.5 ? 10 : span > 0.5 ? 12 : 13

        const snippets = await collectRegionSnippets(browser, center, zoom)
        fetched = snippets.length

        const stations = snippets
          .map((snippet) => normalizeSnippet(snippet, region.city))
          .filter((station): station is ImportedStation => station !== null)

        if (stations.length) saved = await upsertImportedStations(stations, run.id)
      } catch (cause) {
        error = cause instanceof Error ? cause.message : "Яндекс Карты не ответили"
        failedTotal += 1
      }

      fetchedTotal += fetched
      savedTotal += saved
      regionResults.push({ key: region.key, city: region.city, fetched, saved, error })

      if (pauseMs > 0) await new Promise((resolve) => setTimeout(resolve, pauseMs))
    }
  } finally {
    /* Браузер закрывается всегда: брошенный процесс держит сотни
       мегабайт, и через сутки прогонов сервер остаётся без памяти. */
    await closeBrowser()
  }

  const status: YandexCollectResult["status"] =
    failedTotal === 0 ? "SUCCEEDED" : failedTotal === regions.length ? "FAILED" : "PARTIAL"

  await finishFuelImportRun(run.id, { status, fetched: fetchedTotal, upserted: savedTotal, failed: failedTotal })

  return {
    runId: run.id,
    status,
    regions: regionResults,
    fetched: fetchedTotal,
    saved: savedTotal,
    failed: failedTotal,
    message: null,
  }
}
