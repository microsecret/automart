"use client"

import { useDeferredValue, useMemo, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { Badge, Box, Button, Group, Loader, Stack, Text, TextInput } from "@mantine/core"
import { IconMapPin, IconPhotoOff, IconSearch, IconX } from "@tabler/icons-react"
import { fetchJson } from "@/lib/api-client"
import { formatMileage, formatPriceShort } from "@/lib/format-numbers"
import { parseImages } from "@/lib/format"

/**
 * Лента машин в приложении Telegram.
 *
 * Раньше приложение открывалось экраном приветствия со списком ссылок по
 * группам: человек входил и упирался в меню, не увидев ни одной машины.
 * Продавец не понимал, что здесь вообще продают, а покупатель уходил.
 *
 * Здесь товар с первого экрана — как в любом мобильном приложении
 * маркетплейса. Карточка сжата до того, по чему принимают решение
 * листая: фотография, цена, название, год и пробег.
 */

type FeedVehicle = {
  id: string
  make: string
  model: string
  year: number
  mileage: number | null
  images: string | null
  location: string | null
  vehicleType?: string | null
}

type FeedListing = {
  id: string
  title: string
  price: number | null
  createdAt?: string
  vehicle?: FeedVehicle | null
}

type FeedResponse = { listings: FeedListing[]; pagination?: { total: number } }

/** Сколько машин показывать: экран телефона вмещает три-четыре карточки. */
const FEED_LIMIT = 24

export default function TelegramFeed({ vehicleType }: { vehicleType?: string }) {
  const [search, setSearch] = useState("")
  /* Запрос уходит с задержкой относительно набора: иначе каждая буква
     отправляла бы запрос, а на телефоне это ещё и заметная задержка
     отрисовки при медленной сети. */
  const deferredSearch = useDeferredValue(search.trim())

  const query = new URLSearchParams({ type: "vehicle", limit: String(FEED_LIMIT), sort: "newest" })
  if (vehicleType) query.set("vehicleType", vehicleType)
  if (deferredSearch.length > 1) query.set("q", deferredSearch)

  const { data, error, isLoading, isValidating, mutate } = useSWR<FeedResponse>(`/api/listings?${query}`, fetchJson, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })

  const searchField = (
    <Box className="tg-search">
      <TextInput
        className="tg-search__input"
        placeholder="Марка, модель или город"
        aria-label="Поиск по объявлениям"
        leftSection={<IconSearch size={16} />}
        rightSection={
          search ? (
            <button
              type="button"
              className="tg-search__clear"
              onClick={() => setSearch("")}
              aria-label="Очистить поиск"
            >
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
          <Text size="xs" c="var(--tg-hint)">Загружаем объявления…</Text>
        </Stack>
      </>
    )
  }

  const listings = data?.listings || []
  const searching = deferredSearch.length > 1

  /* Сбой запроса — не то же самое, что пустой раздел.

     Ошибка из SWR не бралась вовсе: упавший запрос давал пустые данные,
     и человек видел «Пока пусто. В этом разделе ещё нет объявлений».
     В мобильной сети это случается регулярно, и вывод получался
     противоположный правде — «площадка пустая», после чего человек
     уходит. Повторить было нечем: кнопки нет, обновления по возврату
     на вкладку тоже. */
  if (error) {
    return (
      <>
        {searchField}
        <Stack align="center" py={48} gap={10}>
          <Text fw={700} c="var(--tg-text)">Не удалось загрузить</Text>
          <Text size="xs" c="var(--tg-hint)" ta="center" maw={270}>
            Проверьте связь и попробуйте ещё раз — объявления никуда не делись.
          </Text>
          <Button size="sm" className="tg-button" onClick={() => void mutate()}>Повторить</Button>
        </Stack>
      </>
    )
  }

  if (!listings.length) {
    return (
      <>
        {searchField}
        <Stack align="center" py={48} gap={6}>
          <Text fw={700} c="var(--tg-text)">
            {searching ? "Ничего не нашлось" : "Пока пусто"}
          </Text>
          <Text size="xs" c="var(--tg-hint)" ta="center" maw={270}>
            {searching
              ? "Попробуйте другое название или проверьте раскладку."
              : "В этом разделе ещё нет объявлений. Разместите первым — это бесплатно."}
          </Text>
        </Stack>
      </>
    )
  }

  return (
    <>
      {searchField}
      {/* Выдача приглушается на время обновления, а не подменяется молча:
          человек набирает запрос и видит, что идёт работа, не теряя
          прежний результат из виду. */}
      <Stack gap="var(--tg-card-gap)" pb={8} className="tg-feed" data-updating={isValidating || undefined}>
        {listings.map((listing) => (
          <TelegramFeedCard key={listing.id} listing={listing} />
        ))}
      </Stack>
    </>
  )
}

function TelegramFeedCard({ listing }: { listing: FeedListing }) {
  const [failed, setFailed] = useState(false)
  const vehicle = listing.vehicle
  const image = useMemo(() => parseImages(vehicle?.images)[0] || null, [vehicle?.images])

  /* Отклик при переходе — то, чем приложение отличается от страницы.

     Лёгкий, не средний: переход по карточке случается часто, и сильный
     отклик на частом действии быстро надоедает. */
  const tap = () => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light")

  const isFresh = Boolean(
    listing.createdAt && Date.now() - new Date(listing.createdAt).getTime() < 86_400_000,
  )

  return (
    <Box
      component={Link}
      href={`/listings/vehicle/${vehicle?.id || listing.id}?from=telegram`}
      onClick={tap}
      className="tg-card"
    >
      <Box className="tg-card__media">
        {image && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : listing.title}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          <Box className="tg-card__media-empty">
            <IconPhotoOff size={22} />
          </Box>
        )}
        {isFresh && <Badge className="tg-card__badge" size="xs">Сегодня</Badge>}
      </Box>

      <Box className="tg-card__body">
        <Text className="tg-card__price">{formatPriceShort(listing.price)}</Text>
        <Text className="tg-card__title" lineClamp={1}>
          {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : listing.title}
        </Text>
        <Group gap={6} wrap="nowrap" className="tg-card__facts">
          {vehicle?.mileage != null && <span>{formatMileage(vehicle.mileage)}</span>}
          {vehicle?.location && (
            <span className="tg-card__place">
              <IconMapPin size={11} />
              {vehicle.location}
            </span>
          )}
        </Group>
      </Box>
    </Box>
  )
}
