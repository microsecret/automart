"use client"

import Link from "next/link"
import useSWR from "swr"
import { Box, Text } from "@mantine/core"
import { fetchJson } from "@/lib/api-client"
import WidgetSkeleton from "./WidgetSkeleton"
import { formatPriceShort } from "@/lib/format"
import { cleanModelLabel, isShowcaseReady } from "@/lib/auction-model-quality"

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
   по модели, и из двадцати лотов надо набрать пять разных машин. */
const FETCH_LIMIT = 20

const COUNTRY_LABELS: Record<string, string> = {
  JP: "Япония",
  KR: "Корея",
  CN: "Китай",
  DE: "Германия",
  US: "США",
}

/**
 * Разбавление ленты по марке и модели.
 *
 * Сбор приносит лоты пачками: замер выдачи показал три «Daihatsu
 * haizettokago» и две «Hyundai Palisade» подряд в первых пяти. Колонка
 * выглядела так, будто на площадке торгуют одной машиной в пяти
 * экземплярах.
 *
 * Сначала пробовал разбавлять по стране — не помогло: в свежей двадцатке
 * всего две страны (Япония 13, Корея 7), и после двух строк правило
 * переставало работать. Марка с моделью различает лоты по-настоящему.
 *
 * Берём не больше одного лота на модель, потом добиваем остатком по
 * порядку. Ничего не выдумано: показаны настоящие свежие лоты, просто в
 * другом порядке.
 */
function diverseByModel(lots: Lot[], limit: number): Lot[] {
  const picked: Lot[] = []
  const seen = new Set<string>()

  for (const lot of lots) {
    /* Ключ считается по очищенному названию — тому, что человек увидит
       на экране. Раньше брали сырое: два лота «Citroen C3eakurosuSUV» и
       «Citroen C5eakurosuSUV» различались, а после чистки оба
       превращались в «Citroen», и в колонке вставали две одинаковые
       строки подряд. */
    const key = `${lot.make ?? ""} ${cleanModelLabel(lot.model)}`.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    picked.push(lot)
    if (picked.length === limit) return picked
  }

  /* Если разных моделей меньше, чем нужно строк, добираем повторами:
     короткий список хуже, чем список с двумя одинаковыми марками. */
  for (const lot of lots) {
    if (picked.length === limit) break
    if (!picked.includes(lot)) picked.push(lot)
  }

  return picked
}

export default function FreshLotsWidget() {
  const { data } = useSWR<AuctionsResponse>(`/api/auctions?limit=${FETCH_LIMIT}&view=brief`, fetchJson, {
    revalidateOnFocus: false,
  })

  /* Отсев негодных названий: внешняя служба перевода иногда склеивает
     языки внутри слова — «Hyundai беNew», «Casper 1.0 инсыпоRayсён». В
     колонке из пяти строк одна такая занимает пятую часть блока. */
  const all = (data?.listings ?? []).filter(isShowcaseReady)
  const lots = diverseByModel(all, VISIBLE)

  if (!data) return <WidgetSkeleton tone="lots" />
  if (lots.length < 3) return null

  return (
    <Box component="section" className="side-widget" data-tone="lots" aria-label="Свежие лоты аукционов">
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
                {/* Название без мусорного хвоста: внешний перевод
                    оставляет склейки вроде «125KMlidarFlagship». */}
                {[lot.make, cleanModelLabel(lot.model)].filter(Boolean).join(" ")}
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
