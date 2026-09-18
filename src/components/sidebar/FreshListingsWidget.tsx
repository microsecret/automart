"use client"

import Link from "next/link"
import useSWR from "swr"
import { Box, Text } from "@mantine/core"
import { fetchJson } from "@/lib/api-client"
import { formatPriceShort } from "@/lib/format"

/**
 * Свежие объявления от владельцев в правой колонке.
 *
 * Аукционные лоты рядом идут тысячами, объявлений же несколько десятков —
 * и это как раз причина показать их отдельной строкой. Человек, который
 * ищет машину «здесь и сейчас, без растаможки», иначе не увидит их за
 * восемью тысячами лотов.
 */

type Listing = {
  id: string
  title: string | null
  price: number | null
  city: string | null
  /* id машины нужен для ссылки: страница объявления живёт по адресу
     /listings/vehicle/{id машины}, а не /listings/{id объявления}.
     Первая версия виджета ссылалась на второй — замер живой страницы
     показал четыре ответа 404 на каждую загрузку главной. */
  vehicle?: { id?: string; make?: string | null; model?: string | null; year?: number | null } | null
  part?: { id?: string } | null
}

type ListingsResponse = { listings?: Listing[] }

const VISIBLE = 5

/* Берём с запасом: ниже отсеиваются объявления без цены, а их доля
   заранее неизвестна. */
const FETCH_LIMIT = 10

export default function FreshListingsWidget() {
  const { data } = useSWR<ListingsResponse>(
    `/api/listings?limit=${FETCH_LIMIT}&sort=newest`,
    fetchJson,
    { revalidateOnFocus: false },
  )

  /* Объявление без цены в узкой колонке бесполезно: название и город
     не дают того, ради чего сюда смотрят.

     Предикат сужает тип price до числа — иначе ниже пришлось бы ставить
     восклицательный знак, то есть просить компилятор поверить на слово
     там, где можно проверить. */
  const listings = (data?.listings ?? [])
    .filter(
      (item): item is Listing & { price: number } =>
        typeof item.price === "number" &&
        item.price > 0 &&
        /* Без id машины или запчасти ссылку не построить, и строка вела
           бы на страницу «не найдено». */
        Boolean(item.vehicle?.id || item.part?.id),
    )
    .slice(0, VISIBLE)

  if (listings.length < 3) return null

  return (
    <Box component="section" className="side-widget" aria-label="Свежие объявления">
      <Box className="side-widget__head">
        <Text component="h2" className="side-widget__title">Свежие объявления</Text>
        <Link href="/" className="side-widget__all">Все</Link>
      </Box>

      <Box className="side-widget__body">
        {listings.map((item) => {
          const name =
            [item.vehicle?.make, item.vehicle?.model].filter(Boolean).join(" ") || item.title || "Объявление"
          /* Машина и запчасть лежат по разным адресам. Объявление без
             того и другого пропускается фильтром выше — ссылки в
             никуда быть не должно. */
          const href = item.vehicle?.id
            ? `/listings/vehicle/${item.vehicle.id}`
            : `/listings/part/${item.part?.id}`
          return (
            <Link key={item.id} href={href} className="lot-row">
              <span className="lot-row__name">
                {name}
                {item.vehicle?.year ? <span className="lot-row__year"> {item.vehicle.year}</span> : null}
              </span>
              <span className="lot-row__meta">
                <span className="lot-row__price">{formatPriceShort(item.price)}</span>
                {item.city ? <span className="lot-row__country">{item.city}</span> : null}
              </span>
            </Link>
          )
        })}
      </Box>
    </Box>
  )
}
