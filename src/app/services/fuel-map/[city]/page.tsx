import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { buildSeoMetadata } from "@/lib/seo-metadata"
import { cityFromSlug, cityInPrepositional } from "@/lib/fuel-city-slug"
import { CITY_COORDINATES } from "@/lib/cities"
import { listNearbyFuelCities } from "@/lib/fuel-city-links"
import { absoluteUrl } from "@/lib/site-url"

/**
 * Городская страница карты АЗС.
 *
 * Карта жила по одному адресу на всю страну: заголовок обещал Россию, а
 * человек искал «цены на бензин в Уфе». Вести его было некуда — города не
 * было ни в адресе, ни в заголовке, ни в тексте страницы.
 *
 * Здесь всё это есть, и главное — цены отдаются прямо в разметке, а не
 * подгружаются скриптом. Поисковик читает страницу целиком: марки, средние
 * цены, число заправок. Карта рядом, для тех, кто пришёл искать по месту.
 *
 * Разметка нарочно без Mantine: библиотека клиентская, и страница с ней
 * рендерилась бы в браузере — то есть пришла бы поисковику пустой, ради
 * чего всё и затевалось. Обычные теги со скромными стилями отдаются
 * сервером готовыми.
 */

/* Раз в час: цены на топливо меняются не чаще, а пересчитывать среднее по
   городу на каждый заход поисковика незачем. */
export const revalidate = 3600

const FUEL_LABELS: Record<string, string> = {
  AI92: "АИ-92",
  AI95: "АИ-95",
  AI98: "АИ-98",
  AI100: "АИ-100",
  DT: "ДТ",
  GAS: "Газ",
}
const FUEL_ORDER = ["AI92", "AI95", "AI98", "AI100", "DT", "GAS"]

/* Пустая страница отвечает на запрос ничем, и поисковик справедливо считает
   её мусорной. Пятнадцать заправок — тот минимум, при котором средняя цена
   по городу уже что-то значит. */
const MIN_STATIONS_FOR_PAGE = 15

type CityFuelSummary = {
  city: string
  stationCount: number
  prices: Array<{ fuel: string; label: string; averageRub: number; minRub: number; maxRub: number; stations: number }>
  brands: Array<{ brand: string; count: number }>
  updatedAt: Date | null
}

async function loadCitySummary(city: string): Promise<CityFuelSummary | null> {
  const stations = await prisma.fuelStationImport.findMany({
    where: { city },
    select: { brand: true, updatedAt: true, prices: { select: { fuel: true, priceRub: true } } },
  })
  if (stations.length < MIN_STATIONS_FOR_PAGE) return null

  const byFuel = new Map<string, number[]>()
  const byBrand = new Map<string, number>()
  let updatedAt: Date | null = null

  for (const station of stations) {
    if (!updatedAt || station.updatedAt > updatedAt) updatedAt = station.updatedAt
    const brand = station.brand?.trim()
    if (brand) byBrand.set(brand, (byBrand.get(brand) ?? 0) + 1)
    for (const price of station.prices) {
      const bucket = byFuel.get(price.fuel)
      if (bucket) bucket.push(price.priceRub)
      else byFuel.set(price.fuel, [price.priceRub])
    }
  }

  const prices = FUEL_ORDER.flatMap((fuel) => {
    const raw = byFuel.get(fuel)
    if (!raw?.length) return []

    /* Выбросы отсекаются по медиане.

       Источники приносят и опечатки, и цены за что-то другое: по Уфе
       максимум АИ-92 доходил до 117 рублей при средней в 66. Такая строка
       в таблице подрывает доверие ко всей странице — человек видит цифру,
       которой на колонках не бывает, и правильно заключает, что данным
       верить нельзя.

       Медиана устойчива к единичным выбросам, а всё, что отклоняется от
       неё больше чем на треть, в расчёт не идёт. Порог широкий нарочно:
       между дешёвой сетью и дорогой заправкой на трассе разница
       действительно бывает заметной. */
    const sorted = [...raw].sort((left, right) => left - right)
    const median = sorted[Math.floor(sorted.length / 2)]
    const values = sorted.filter((value) => Math.abs(value - median) <= median * 0.35)
    if (!values.length) return []

    const sum = values.reduce((total, value) => total + value, 0)
    return [{
      fuel,
      label: FUEL_LABELS[fuel] || fuel,
      averageRub: sum / values.length / 100,
      minRub: values[0] / 100,
      maxRub: values[values.length - 1] / 100,
      stations: values.length,
    }]
  })

  const brands = [...byBrand.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([brand, count]) => ({ brand, count }))

  return { city, stationCount: stations.length, prices, brands, updatedAt }
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city: slug } = await params
  const city = cityFromSlug(slug)
  if (!city) {
    return buildSeoMetadata({
      title: "Карта АЗС",
      description: "Цены на топливо и наличие на заправках.",
      canonical: "/services/fuel-map",
    })
  }

  const where = cityInPrepositional(city)
  const summary = await loadCitySummary(city)
  const petrol = summary?.prices.find((row) => row.fuel === "AI92")
  /* Цена в описании выдачи — то, ради чего человек и кликает: «АИ-92 от
     62,80 ₽» отвечает на вопрос ещё до перехода на страницу. */
  const priceHint = petrol ? ` АИ-92 от ${petrol.minRub.toFixed(2).replace(".", ",")} ₽.` : ""
  const countHint = summary ? `${summary.stationCount} АЗС на карте` : "карта заправок"

  return buildSeoMetadata({
    title: `Цены на бензин в ${where} — ${countHint}`,
    description: `Актуальные цены на АИ-92, АИ-95, ДТ и газ на заправках ${city}.${priceHint} Наличие топлива по отметкам водителей.`,
    canonical: `/services/fuel-map/${slug}`,
    keywords: [
      `цены на бензин в ${where}`,
      `АЗС ${city}`,
      `заправки ${city}`,
      `где заправиться в ${where}`,
      `дизельное топливо ${city}`,
    ],
  })
}

function formatPrice(value: number) {
  return value.toFixed(2).replace(".", ",")
}

export default async function FuelCityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params
  const city = cityFromSlug(slug)
  if (!city || !CITY_COORDINATES[city]) notFound()

  const summary = await loadCitySummary(city)
  if (!summary) notFound()

  const nearby = await listNearbyFuelCities(city)

  const where = cityInPrepositional(city)

  /* Разметка для поисковика: без неё цены остаются просто текстом, а с ней
     попадают в расширенный ответ выдачи. */
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `Цены на топливо в ${where}`,
    description: `Цены на АИ-92, АИ-95, ДТ и газ на ${summary.stationCount} заправках города ${city}.`,
    dateModified: summary.updatedAt?.toISOString(),
    creator: { "@type": "Organization", name: "LeWheel" },
  }

  /* Хлебные крошки в разметке: поисковик рисует по ним путь под ссылкой
     вместо голого адреса, и по такому ответу переходят заметно чаще. */
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Карта АЗС", item: absoluteUrl("/services/fuel-map") },
      { "@type": "ListItem", position: 3, name: city, item: absoluteUrl(`/services/fuel-map/${slug}`) },
    ],
  }

  /* Вопросы и ответы — ровно те, что человек набирает в поиске.

     Ответы собраны из уже посчитанных чисел, а не написаны наперёд: если
     цены в городе изменятся, изменится и ответ. Выдуманный ответ в этой
     разметке — прямой путь к санкциям поисковика. */
  const cheapest = summary.prices.length
    ? [...summary.prices].sort((left, right) => left.averageRub - right.averageRub)[0]
    : null

  const faq = cheapest ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `Сколько стоит бензин в ${where}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: summary.prices
            .map((price) => `${price.label} — ${price.averageRub.toFixed(2)} ₽`)
            .join(", ") + ` (средние цены по ${summary.stationCount} заправкам).`,
        },
      },
      {
        "@type": "Question",
        name: `Сколько заправок в ${where}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `На карте ${summary.stationCount} заправок${summary.brands.length ? `, крупнейшие сети — ${summary.brands.slice(0, 3).map((item) => item.brand).join(", ")}` : ""}.`,
        },
      },
      {
        "@type": "Question",
        name: "Откуда берутся цены на карте?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Цены собираются из открытых источников и уточняются отметками водителей — тех, кто прямо сейчас стоит у колонки. Отметить цену может любой вошедший.",
        },
      },
    ],
  } : null

  return (
    <main className="fuel-city">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      {faq && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />}

      <h1 className="fuel-city__title">Цены на бензин в {where}</h1>
      <p className="fuel-city__lead">
        {summary.stationCount} заправок на карте. Цены собраны из открытых источников
        и уточняются отметками водителей — тех, кто прямо сейчас стоит у колонки.
      </p>

      {summary.prices.length > 0 && (
        <section>
          <h2 className="fuel-city__subtitle">Средние цены на топливо</h2>
          <div className="fuel-city__table-wrap">
            <table className="fuel-city__table">
              <thead>
                <tr>
                  <th>Топливо</th>
                  <th>Средняя</th>
                  <th>Минимум</th>
                  <th>Максимум</th>
                  <th>АЗС</th>
                </tr>
              </thead>
              <tbody>
                {summary.prices.map((row) => (
                  <tr key={row.fuel}>
                    <td><strong>{row.label}</strong></td>
                    <td>{formatPrice(row.averageRub)} ₽</td>
                    <td>{formatPrice(row.minRub)} ₽</td>
                    <td>{formatPrice(row.maxRub)} ₽</td>
                    <td>{row.stations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {summary.brands.length > 0 && (
        <section>
          <h2 className="fuel-city__subtitle">Сети АЗС в городе</h2>
          <ul className="fuel-city__brands">
            {summary.brands.map((row) => (
              <li key={row.brand}>{row.brand} — {row.count} АЗС</li>
            ))}
          </ul>
        </section>
      )}

      {nearby.length > 0 && (
        /* Ссылки на соседние города.

           Страницы городов существовали, но на них не вело ни одной
           ссылки с сайта — поисковик находил их только через карту сайта,
           без внутреннего веса, и такая страница-сирота ранжируется в
           разы хуже связанной.

           Соседи полезны и человеку: тот, кто смотрит цены в
           Первоуральске, поедет скорее через Екатеринбург, чем через
           Казань. */
        <section className="fuel-city__section">
          <h2>Цены на топливо рядом</h2>
          <ul className="fuel-city__cities">
            {nearby.map((item) => (
              <li key={item.slug}>
                <Link href={`/services/fuel-map/${item.slug}`}>
                  {item.city}
                </Link>
                <span className="fuel-city__cities-count">{item.stationCount} АЗС</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="fuel-city__cta">
        <Link href={`/services/fuel-map?city=${encodeURIComponent(city)}`}>
          Открыть карту заправок {city} →
        </Link>
      </p>

      <p className="fuel-city__note">
        Цены носят справочный характер и могут отличаться от табло на заправке.
        Точнее всего их знают водители: отметьте цену на карте, если заметили расхождение.
      </p>
    </main>
  )
}
