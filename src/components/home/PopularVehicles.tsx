"use client"

import Link from "next/link"
import useSWR from "swr"
import { Box, Group, Text } from "@mantine/core"
import { IconArrowRight } from "@tabler/icons-react"
import { fetchJson } from "@/lib/api-client"
import { plural } from "@/lib/plural"
import ListingCard, { type ListingCardData } from "@/components/listings/ListingCard"

/**
 * Свежие объявления на главной — по макету площадки.
 *
 * На этом месте стояла витрина направлений: семь плиток с названиями
 * разделов. Из них заполнены три — легковые, мото и грузовики, — а
 * четыре показывали «Разместить первым». Человек, пришедший смотреть
 * машины, на первом экране после героя видел список пустых категорий.
 *
 * Здесь показываются сами машины. Это ровно то, за чем сюда приходят, и
 * это же лучший ответ на вопрос «есть ли тут вообще что-нибудь».
 *
 * Направления никуда не делись — они остались ниже, где уместны: там
 * человек уже посмотрел товар и выбирает, куда идти дальше.
 */

type ListingsResponse = {
  listings?: ListingCardData[]
  pagination?: { total?: number }
}

/* Пять карточек: четыре в ряд на широком экране плюс одна в начале
   второго ряда выглядели бы обрывком, поэтому берём ровно столько,
   сколько укладывается в строку на любом размере — четыре колонки на
   десктопе, две на планшете, лента на телефоне. */
const VISIBLE = 4

export default function PopularVehicles() {
  /* Сортировка по свежести, а не по просмотрам.

     «Популярные» просилось по макету, но 131 просмотр на 39 объявлений
     — это не популярность, а случайные заходы: первое место занял бы
     тот, кого один раз открыли трижды. Свежие объявления — честный
     повод показать их первыми, и заголовок говорит ровно это. */
  const { data } = useSWR<ListingsResponse>(
    `/api/listings?type=vehicle&sort=newest&limit=${VISIBLE}`,
    fetchJson,
    { revalidateOnFocus: false },
  )

  const listings = data?.listings ?? []

  /* Пока объявлений нет, блока нет вовсе: пустая витрина на главной
     хуже её отсутствия — она говорит, что площадка не работает. */
  if (!listings.length) return null

  const total = data?.pagination?.total ?? 0

  return (
    <Box component="section" className="popular-vehicles" aria-label="Популярные автомобили">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm" mb="md">
        <Box>
          <Text component="h2" fw={800} fz="var(--text-2xl)" c="var(--market-ink)">
            Свежие объявления
          </Text>
          <Text size="sm" c="dimmed">
            {total > 0
              ? `${total} ${plural(total, "объявление", "объявления", "объявлений")} от владельцев и дилеров`
              : "Объявления от владельцев и дилеров"}
          </Text>
        </Box>
        <Link href="/search" className="popular-vehicles__all">
          Все авто
          <IconArrowRight size={15} />
        </Link>
      </Group>

      <Box className="popular-vehicles__grid">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </Box>
    </Box>
  )
}
