"use client"

import Link from "next/link"
import useSWR from "swr"
import { Box, Text } from "@mantine/core"
import { fetchJson } from "@/lib/api-client"
import { formatPriceShort } from "@/lib/format"

/**
 * Свежие лоты мировых аукционов в правой колонке.
 *
 * За сутки приезжает 367 новых лотов из 16 007 — колонка оживает сама,
 * без единой строчки «скоро здесь что-то будет».
 */

type Lot = {
  id: string
  make: string | null
  model: string | null
  year: number | null
  priceRub: number | null
  finalPrice: number | null
  country: string | null
  imageUrl: string | null
}

type AuctionsResponse = { listings?: Lot[] }

const VISIBLE = 5

/* Запрашиваем вчетверо больше, чем показываем: ниже лента разбавляется
   по странам, и из двадцати лотов надо набрать пять разных. */
const FETCH_LIMIT = 20

const COUNTRY_LABELS: Record<string, string> = {
  JP: "Япония",
  KR: "Корея",
  CN: "Китай",
  DE: "Германия",
  US: "США",
}

/**
 * Разбавление ленты по странам.
 *
 * Приём подсмотрен у площадки RawMart и решает настоящую беду: сбор
 * приносит лоты пачками, и из 16 007 машин 4970 корейских. Пять свежих
 * подряд — это почти наверняка пять корейских седанов, и колонка
 * выглядит так, будто на площадке торгуют чем-то одним.
 *
 * Берём не больше одного лота на страну, потом добиваем остатком по
 * порядку. Разнообразие видно с первого взгляда, и при этом ничего не
 * выдумано: показаны настоящие свежие лоты, просто в другом порядке.
 */
function diverseByCountry(lots: Lot[], limit: number): Lot[] {
  const picked: Lot[] = []
  const seenCountries = new Set<string>()

  for (const lot of lots) {
    const country = lot.country ?? "—"
    if (seenCountries.has(country)) continue
    seenCountries.add(country)
    picked.push(lot)
    if (picked.length === limit) return picked
  }

  for (const lot of lots) {
    if (picked.length === limit) break
    if (!picked.includes(lot)) picked.push(lot)
  }

  return picked
}

export default function FreshLotsWidget() {
  const { data } = useSWR<AuctionsResponse>(`/api/auctions?limit=${FETCH_LIMIT}`, fetchJson, {
    revalidateOnFocus: false,
  })

  const all = (data?.listings ?? []).filter((lot) => lot.make || lot.model)
  const lots = diverseByCountry(all, VISIBLE)

  if (lots.length < 3) return null

  return (
    <Box component="section" className="side-widget" aria-label="Свежие лоты аукционов">
      <Box className="side-widget__head">
        <Text component="h2" className="side-widget__title">Свежие лоты</Text>
        <Link href="/auctions" className="side-widget__all">Все</Link>
      </Box>

      <Box className="side-widget__body">
        {lots.map((lot) => {
          const price = lot.priceRub ?? lot.finalPrice
          return (
            <Link key={lot.id} href={`/auctions/${lot.id}`} className="lot-row">
              <span className="lot-row__name">
                {[lot.make, lot.model].filter(Boolean).join(" ")}
                {lot.year ? <span className="lot-row__year"> {lot.year}</span> : null}
              </span>
              <span className="lot-row__meta">
                {/* Цена показывается, только если она есть. Часть лотов
                    приходит без итоговой суммы — «0 ₽» в таком случае
                    было бы не ценой, а ошибкой сбора. */}
                {price ? <span className="lot-row__price">{formatPriceShort(price)}</span> : null}
                {lot.country ? (
                  <span className="lot-row__country">{COUNTRY_LABELS[lot.country] ?? lot.country}</span>
                ) : null}
              </span>
            </Link>
          )
        })}
      </Box>
    </Box>
  )
}
