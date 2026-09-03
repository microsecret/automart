"use client"

import Link from "next/link"
import NextImage from "next/image"
import useSWR from "swr"
import { Box, Group, Text } from "@mantine/core"
import { IconArrowRight } from "@tabler/icons-react"
import { fetchJson } from "@/lib/api-client"
import { formatPriceShort } from "@/lib/format"

/**
 * Свежие лоты мировых аукционов на главной.
 *
 * Замер на боевом сервере: девять тысяч двести девяносто два аукционных
 * лота против двадцати объявлений в каталоге. Самое богатое, что есть у
 * площадки, пряталось за одной ссылкой в герое — человек читал «машины с
 * мировых аукционов», листал вниз и видел два десятка объявлений.
 *
 * Витрина показывает лоты, а не рассказывает о них: восемь машин с ценой
 * и страной. Это ровно то, ради чего сюда приходят, и это же лучший
 * ответ на вопрос «а есть ли тут вообще что-нибудь».
 */

type AuctionLot = {
  id: string
  make: string | null
  model: string | null
  year: number | null
  mileage: number | null
  finalPrice: number | null
  priceRub: number | null
  country: string | null
  imageUrl: string | null
}

type AuctionsResponse = {
  listings?: AuctionLot[]
  pagination?: { total?: number }
}

const COUNTRY_LABELS: Record<string, string> = {
  JP: "Япония",
  KR: "Корея",
  CN: "Китай",
  US: "США",
  EU: "Европа",
  DE: "Германия",
}

/* Восемь лотов: четыре в ряд на широком экране, два на планшете и лента
   на телефоне. Больше — и блок начинает соперничать с самим каталогом,
   меньше — не читается как витрина. */
const VISIBLE_LOTS = 8

export default function AuctionShowcase() {
  const { data } = useSWR<AuctionsResponse>(`/api/auctions?limit=${VISIBLE_LOTS}`, fetchJson, {
    /* Лоты обновляются раз в несколько часов сбором, а не ежеминутно:
       перезапрашивать их при каждом возврате на вкладку незачем. */
    revalidateOnFocus: false,
  })

  const lots = (data?.listings ?? []).filter((lot) => lot.make || lot.model)
  const total = data?.pagination?.total ?? 0

  /* Пока лотов нет, блока нет вовсе: пустая витрина на главной хуже её
     отсутствия — она говорит, что площадка не работает. */
  if (!lots.length) return null

  return (
    <Box className="auction-showcase" component="section" aria-label="Свежие лоты мировых аукционов">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm" mb="md">
        <Box>
          <Text component="h2" fw={800} fz={{ base: 20, md: 24 }} c="var(--market-ink)">
            С мировых аукционов
          </Text>
          <Text size="sm" c="dimmed">
            {total > 0
              ? `${total.toLocaleString("ru-RU")} живых лотов из Японии, Кореи, Китая, США и Европы`
              : "Лоты из Японии, Кореи, Китая, США и Европы"}
          </Text>
        </Box>
        <Link href="/auctions" className="auction-showcase__all">
          Все лоты
          <IconArrowRight size={15} />
        </Link>
      </Group>

      <Box className="auction-showcase__grid">
        {lots.map((lot) => {
          const price = lot.finalPrice ?? lot.priceRub
          const country = lot.country ? COUNTRY_LABELS[lot.country] ?? lot.country : null

          return (
            <Link key={lot.id} href={`/auctions/${lot.id}`} className="auction-showcase__card">
              <Box className="auction-showcase__media">
                {lot.imageUrl ? (
                  <NextImage
                    src={lot.imageUrl}
                    alt={`${lot.make ?? ""} ${lot.model ?? ""}`.trim()}
                    fill
                    sizes="(max-width: 640px) 60vw, (max-width: 1024px) 33vw, 25vw"
                    className="auction-showcase__image"
                  />
                ) : (
                  <Box className="auction-showcase__media-empty" aria-hidden="true" />
                )}
                {country && <span className="auction-showcase__country">{country}</span>}
              </Box>

              <Box className="auction-showcase__body">
                {/* Цена первой строкой: листая витрину, человек сравнивает
                    цены, а не названия. */}
                <Text className="auction-showcase__price">
                  {price ? formatPriceShort(price) : "Цена по запросу"}
                </Text>
                <Text className="auction-showcase__title" lineClamp={1}>
                  {[lot.make, lot.model].filter(Boolean).join(" ")}
                </Text>
                <Text className="auction-showcase__meta">
                  {[
                    lot.year ? `${lot.year}` : null,
                    lot.mileage ? `${Math.round(lot.mileage / 1000)} тыс. км` : null,
                  ].filter(Boolean).join(" · ") || " "}
                </Text>
              </Box>
            </Link>
          )
        })}
      </Box>
    </Box>
  )
}
