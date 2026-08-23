"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { Badge, Box, Group, Loader, Stack, Text } from "@mantine/core"
import { IconMapPin, IconPhotoOff } from "@tabler/icons-react"
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
  const query = new URLSearchParams({ type: "vehicle", limit: String(FEED_LIMIT), sort: "newest" })
  if (vehicleType) query.set("vehicleType", vehicleType)

  const { data, isLoading } = useSWR<FeedResponse>(`/api/listings?${query}`, fetchJson, {
    revalidateOnFocus: false,
  })

  if (isLoading) {
    return (
      <Stack align="center" py={48} gap="xs">
        <Loader size="sm" color="var(--tg-accent)" />
        <Text size="xs" c="var(--tg-hint)">Загружаем объявления…</Text>
      </Stack>
    )
  }

  const listings = data?.listings || []
  if (!listings.length) {
    return (
      <Stack align="center" py={48} gap={6}>
        <Text fw={700} c="var(--tg-text)">Пока пусто</Text>
        <Text size="xs" c="var(--tg-hint)" ta="center" maw={260}>
          В этом разделе ещё нет объявлений. Разместите первым — это бесплатно.
        </Text>
      </Stack>
    )
  }

  return (
    <Stack gap={10} pb={8}>
      {listings.map((listing) => (
        <TelegramFeedCard key={listing.id} listing={listing} />
      ))}
    </Stack>
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
            alt=""
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
