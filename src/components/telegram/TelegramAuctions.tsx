"use client"

import { useDeferredValue, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { Badge, Box, Group, Loader, Stack, Text, TextInput } from "@mantine/core"
import { IconPhotoOff, IconSearch, IconX } from "@tabler/icons-react"
import { fetchJson } from "@/lib/api-client"
import { formatMileage, formatPriceShort } from "@/lib/format-numbers"

/**
 * Лента аукционных лотов в приложении.
 *
 * Отдельно от объявлений: это машины из-за границы, у которых цена в
 * ленте — стоимость лота с комиссией, а не итоговая. Смешивать их с
 * объявлениями частников нельзя: человек сравнивал бы несравнимое.
 */

type AuctionLot = {
  id: string
  make: string
  model: string
  year: number
  mileage: number | null
  finalPrice: number
  country: string
  imageUrl: string | null
}

type AuctionResponse = { listings: AuctionLot[] }

const COUNTRY_FLAGS: Record<string, string> = {
  KR: "🇰🇷", JP: "🇯🇵", CN: "🇨🇳", US: "🇺🇸", DE: "🇩🇪",
}

export default function TelegramAuctions() {
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search.trim())

  const query = new URLSearchParams({ limit: "24" })
  if (deferredSearch.length > 1) query.set("make", deferredSearch)

  const { data, isLoading, isValidating } = useSWR<AuctionResponse>(`/api/auctions?${query}`, fetchJson, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })

  const searchField = (
    <Box className="tg-search">
      <TextInput
        className="tg-search__input"
        placeholder="Марка: Toyota, Hyundai, BMW"
        aria-label="Поиск по маркам"
        leftSection={<IconSearch size={16} />}
        rightSection={
          search ? (
            <button type="button" className="tg-search__clear" onClick={() => setSearch("")} aria-label="Очистить поиск">
              <IconX size={14} />
            </button>
          ) : null
        }
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
        size="md"
      />
    </Box>
  )

  if (isLoading) {
    return (
      <>
        {searchField}
        <Stack align="center" py={48} gap="xs">
          <Loader size="sm" color="var(--tg-accent)" />
          <Text size="xs" c="var(--tg-hint)">Загружаем лоты…</Text>
        </Stack>
      </>
    )
  }

  const lots = data?.listings || []
  const searching = deferredSearch.length > 1

  if (!lots.length) {
    return (
      <>
        {searchField}
        <Stack align="center" py={48} gap={6}>
          <Text fw={700} c="var(--tg-text)">
            {searching ? "Такой марки сейчас нет" : "Лоты обновляются"}
          </Text>
          <Text size="xs" c="var(--tg-hint)" ta="center" maw={270}>
            {searching
              ? "Каталог пополняется каждые двадцать минут — загляните позже или попробуйте другую марку."
              : "Каталог пополняется с площадок Кореи, Японии и Китая. Загляните позже."}
          </Text>
        </Stack>
      </>
    )
  }

  return (
    <>
      {searchField}
      <Stack gap="var(--tg-card-gap)" pb={8} className="tg-feed" data-updating={isValidating || undefined}>
        {lots.map((lot) => (
          <AuctionCard key={lot.id} lot={lot} />
        ))}
      </Stack>
    </>
  )
}

function AuctionCard({ lot }: { lot: AuctionLot }) {
  const [failed, setFailed] = useState(false)
  const tap = () => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light")

  return (
    <Box component={Link} href={`/auctions/${lot.id}?from=telegram`} onClick={tap} className="tg-card">
      <Box className="tg-card__media">
        {lot.imageUrl && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lot.imageUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
        ) : (
          <Box className="tg-card__media-empty"><IconPhotoOff size={22} /></Box>
        )}
        <Badge className="tg-card__badge" size="xs">
          {COUNTRY_FLAGS[lot.country] || lot.country}
        </Badge>
      </Box>

      <Box className="tg-card__body">
        <Text className="tg-card__price">{formatPriceShort(lot.finalPrice)}</Text>
        {/* Природа цены названа прямо: это лот с комиссией, а не итог.
            Без подписи человек сравнивал бы её с ценой объявления, где в
            сумму уже входит всё. */}
        <Text className="tg-card__note">лот + комиссия</Text>
        <Text className="tg-card__title" lineClamp={1}>
          {lot.year} {lot.make} {lot.model}
        </Text>
        <Group gap={6} wrap="nowrap" className="tg-card__facts">
          {lot.mileage != null && <span>{formatMileage(lot.mileage)}</span>}
        </Group>
      </Box>
    </Box>
  )
}
