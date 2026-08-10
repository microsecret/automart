"use client"

import { useEffect, useState } from "react"
import { Card, Text, Group, Badge, Box, Stack, ActionIcon, AspectRatio } from "@mantine/core"
import { IconHeart, IconMapPin } from "@tabler/icons-react"
import Link from "next/link"
import { formatPriceShort, formatMileage, formatRelativeDate, parseImages } from "@/lib/format"
import { findLabel, getFuelOptions, getTransmissionOptions, getUsageMeta, supportsTransmission } from "@/lib/constants"
import BrandIcon from "@/components/brands/BrandIcon"
import { hasBrandLogo } from "@/components/brands/BrandLogo"
import VehicleFallback, { vehicleTypeLabel } from "./VehicleFallback"
import type { ListingCardData } from "./ListingCard"
import { useFavorites } from "@/hooks/useFavorites"
import { useRouter } from "next/navigation"
import { notifications } from "@mantine/notifications"

export type ListingRowData = ListingCardData

const TRUNCATE: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  display: "block",
  maxWidth: "100%",
}

export default function ListingRow({ listing }: { listing: ListingRowData }) {
  const [imageFailed, setImageFailed] = useState(false)
  const router = useRouter()
  const { favoriteIds, isAuthenticated, isPending, toggleFavorite } = useFavorites()

  const isVehicle = !!listing.vehicle
  const detailHref = isVehicle
    ? `/listings/vehicle/${listing.vehicle!.id}`
    : `/listings/part/${listing.part!.id}`

  const images = parseImages(isVehicle ? listing.vehicle!.images : listing.part?.images)
  const sourceImage = images[0] || ""
  const image = sourceImage.includes("/placeholder/") ? "" : sourceImage
  const hasDisplayImage = Boolean(image) && !imageFailed
  const vehicleType = listing.vehicle?.vehicleType || "CAR"
  const usageMeta = getUsageMeta(vehicleType)
  const usageValue = usageMeta.field === "flightHours" ? listing.vehicle?.flightHours
    : usageMeta.field === "operatingHours" ? listing.vehicle?.operatingHours
    : listing.vehicle?.mileage
  const distanceValue = usageValue == null ? "Не указано"
    : usageMeta.field === "mileage" ? formatMileage(usageValue)
    : `${new Intl.NumberFormat("ru-RU").format(usageValue)} ${usageMeta.unit}`
  const showBrandMark = isVehicle && hasBrandLogo(listing.vehicle!.make)
  const isFav = favoriteIds.has(listing.id)
  const missingMediaLabel = isVehicle
    ? `${vehicleTypeLabel(vehicleType, listing.vehicle?.bodyType)} · без фото`
    : "Запчасть · без фото"

  useEffect(() => {
    setImageFailed(false)
  }, [listing.id])

  const toggleFav = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isAuthenticated) {
      notifications.show({
        title: "Войдите, чтобы сохранить",
        message: "Избранное синхронизируется между сайтом и Telegram после авторизации.",
        color: "indigo",
      })
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(detailHref)}`)
      return
    }

    void toggleFavorite(listing.id)
  }

  return (
    <Card
      className="listing-card listing-card--row"
      pos="relative"
      padding={0}
      radius="md"
      withBorder
      style={{
        overflow: "hidden",
        borderColor: "var(--mantine-color-border)",
        transition: "border-color 200ms ease, box-shadow 200ms ease",
        cursor: "pointer",
      }}
    >
      <Link href={detailHref} aria-label={`Открыть объявление: ${listing.title}`} style={{ position: "absolute", inset: 0, zIndex: 1 }} />
        <Group gap={0} align="stretch" wrap="nowrap">
          {/* Фото */}
          <Box
            className="listing-card__media"
            data-empty-media={!hasDisplayImage || undefined}
            data-vehicle-type={isVehicle ? vehicleType.toLowerCase() : "part"}
            pos="relative"
            style={{ width: 180, flexShrink: 0, background: "var(--mantine-color-gray-1)", lineHeight: 0 }}
          >
            {hasDisplayImage ? (
              <AspectRatio ratio={4 / 3} w={180}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={listing.title} onError={() => setImageFailed(true)} loading="lazy" decoding="async" style={{ objectFit: "cover", width: "100%", height: "100%" }} />
              </AspectRatio>
            ) : (
              <Box h="100%" className="listing-card__media" data-empty-media="true"><VehicleFallback type={isVehicle ? vehicleType : "CAR"} bodyType={listing.vehicle?.bodyType} compact /></Box>
            )}
            {listing.isFeatured && (
              <Box pos="absolute" top={6} left={6}>
                <Badge color="dark" variant="filled" size="xs" radius="sm">Премиум</Badge>
              </Box>
            )}
            {!hasDisplayImage && (
              <Box pos="absolute" top={6} right={6}>
                <Badge color="gray" variant="white" size="xs" radius="sm">{missingMediaLabel}</Badge>
              </Box>
            )}
          </Box>

          {/* Контент */}
          <Box p="sm" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <Stack gap={4}>
              <Group justify="space-between" gap="sm" align="flex-start" wrap="nowrap">
                <Group gap="sm" align="center" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                  {showBrandMark && <BrandIcon brand={listing.vehicle!.make} size={32} variant="rounded" />}
                  <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                  <Text fw={500} fz="sm" c="dark.7" style={TRUNCATE}>{listing.title}</Text>
                  <Text fz="xs" c="gray.4" style={TRUNCATE}>
                    {isVehicle ? `${listing.vehicle!.make} ${listing.vehicle!.model}` : listing.part?.name}
                  </Text>
                  </Stack>
                </Group>
                <Text fw={700} fz="md" c="dark.9" ff="var(--font-display), sans-serif" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                  {formatPriceShort(listing.price)}
                </Text>
              </Group>

              {isVehicle && (
                <Group gap={12} wrap="wrap" mt={2}>
                  <Text fz="xs" c="gray.6">{vehicleTypeLabel(vehicleType, listing.vehicle!.bodyType)}</Text>
                  <Text fz="xs" c="gray.6">Год: <Text component="span" inherit fw={700} c="dark.8">{listing.vehicle!.year}</Text></Text>
                  <Text fz="xs" c="gray.6">{usageMeta.label}: <Text component="span" inherit fw={700} c="dark.8">{distanceValue}</Text></Text>
                  {supportsTransmission(vehicleType) && listing.vehicle!.transmission && (
                    <Text fz="xs" c="gray.6">КПП: <Text component="span" inherit fw={700} c="dark.8">{findLabel(getTransmissionOptions(vehicleType), listing.vehicle!.transmission)}</Text></Text>
                  )}
                  {listing.vehicle!.fuelType && (
                    <Text fz="xs" c="gray.6">Топливо: <Text component="span" inherit fw={700} c="dark.8">{findLabel(getFuelOptions(vehicleType), listing.vehicle!.fuelType)}</Text></Text>
                  )}
                </Group>
              )}
            </Stack>

            <Group justify="space-between" gap={4} mt={4}>
              {listing.location ? (
                <Group gap={3} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                  <IconMapPin size={11} stroke={1.8} color="gray.4" style={{ flexShrink: 0 }} />
                  <Text fz="xs" c="gray.4" style={TRUNCATE}>{listing.location}</Text>
                </Group>
              ) : <span />}
              <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
                {listing.createdAt && <Text fz="xs" c="gray.4">{formatRelativeDate(listing.createdAt)}</Text>}
                <ActionIcon
                  color={isFav ? "red" : "gray"}
                  variant={isFav ? "filled" : "subtle"}
                  size="sm"
                  radius="xl"
                  onClick={toggleFav}
                  loading={isPending(listing.id)}
                  aria-label={isFav ? "Убрать из избранного" : "Добавить в избранное"}
                  style={{ position: "relative", zIndex: 2 }}
                >
                  <IconHeart size={14} fill={isFav ? "currentColor" : "none"} />
                </ActionIcon>
              </Group>
            </Group>
          </Box>
        </Group>
    </Card>
  )
}
