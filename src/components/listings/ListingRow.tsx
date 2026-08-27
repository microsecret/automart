"use client"

import { useEffect, useRef, useState } from "react"
import { Card, Text, Group, Badge, Box, Stack, ActionIcon, AspectRatio } from "@mantine/core"
import { IconHeart, IconMapPin , IconScale } from "@tabler/icons-react"
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
import { useCompare } from "@/hooks/useCompare"

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
  const [imageLoaded, setImageLoaded] = useState(false)
  const router = useRouter()
  const { favoriteIds, isAuthenticated, isPending, toggleFavorite } = useFavorites()
  const { inCompare, toggleCompare: handleCompare } = useCompare(listing.id)

  const isVehicle = !!listing.vehicle
  const detailHref = isVehicle
    ? `/listings/vehicle/${listing.vehicle!.id}`
    : `/listings/part/${listing.part!.id}`

  const images = parseImages(isVehicle ? listing.vehicle!.images : listing.part?.images)
  /* Кадр и память касания: в строчном виде показывалось только первое фото
     из двенадцати, и посмотреть остальные можно было лишь открыв
     объявление. */
  const [activeImg, setActiveImg] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const sourceImage = images[activeImg] || images[0] || ""
  const image = sourceImage.includes("/placeholder/") ? "" : sourceImage
  const hasDisplayImage = Boolean(image) && !imageFailed
  const vehicleType = listing.vehicle?.vehicleType || "CAR"
  const usageMeta = getUsageMeta(vehicleType)
  const usageValue = usageMeta.field === "flightHours" ? listing.vehicle?.flightHours
    : usageMeta.field === "operatingHours" ? listing.vehicle?.operatingHours
    : listing.vehicle?.mileage
  const numericUsage = typeof usageValue === "number" && Number.isFinite(usageValue)
    ? usageValue
    : null
  const distanceValue = numericUsage === null ? null
    : usageMeta.field === "mileage" ? formatMileage(numericUsage)
    : `${new Intl.NumberFormat("ru-RU").format(numericUsage)} ${usageMeta.unit}`
  const showBrandMark = isVehicle && hasBrandLogo(listing.vehicle!.make)
  const isFav = favoriteIds.has(listing.id)
  const missingMediaLabel = isVehicle
    ? `${vehicleTypeLabel(vehicleType, listing.vehicle?.bodyType)} · без фото`
    : "Запчасть · без фото"

  useEffect(() => {
    setImageFailed(false)
    setImageLoaded(false)
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
      data-vehicle-type={isVehicle ? vehicleType.toLowerCase() : "part"}
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
        <Group className="listing-card__row-layout" gap={0} align="stretch" wrap="nowrap">
          {/* Фото */}
          <Box
            className="listing-card__media listing-card__row-media"
            data-empty-media={!hasDisplayImage || undefined}
            data-image-loading={hasDisplayImage && !imageLoaded ? "true" : undefined}
            data-vehicle-type={isVehicle ? vehicleType.toLowerCase() : "part"}
            pos="relative"
            style={{ width: 180, flexShrink: 0, background: "var(--mantine-color-gray-1)", lineHeight: 0 }}
            onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null }}
            onTouchEnd={(event) => {
              /* Порог в 40 пикселей отличает свайп от касания: меньший
                 сдвиг — это тап по карточке. */
              const startX = touchStartX.current
              touchStartX.current = null
              if (startX === null || images.length < 2) return
              const delta = (event.changedTouches[0]?.clientX ?? startX) - startX
              if (Math.abs(delta) < 40) return
              event.preventDefault()
              setActiveImg((current) => (current + (delta < 0 ? 1 : -1) + images.length) % images.length)
              setImageFailed(false)
              setImageLoaded(false)
            }}
          >
            {hasDisplayImage ? (
              <AspectRatio ratio={4 / 3} w={180}>
                <>
                  <VehicleFallback type={isVehicle ? vehicleType : "CAR"} bodyType={listing.vehicle?.bodyType} compact />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="listing-card__image"
                    data-loaded={imageLoaded || undefined}
                    src={image}
                    alt={listing.title}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => { setImageFailed(true); setImageLoaded(false) }}
                    loading="lazy"
                    decoding="async"
                  />
                </>
              </AspectRatio>
            ) : (
              <Box h="100%" className="listing-card__media" data-empty-media="true"><VehicleFallback type={isVehicle ? vehicleType : "CAR"} bodyType={listing.vehicle?.bodyType} compact /></Box>
            )}
            {/* Счётчик кадров: показывает, что фото можно листать. */}
            {hasDisplayImage && images.length > 1 && (
              <Box pos="absolute" bottom={6} right={6} style={{ pointerEvents: "none" }}>
                <Badge size="xs" variant="filled" color="dark" radius="sm">
                  {activeImg + 1}/{images.length}
                </Badge>
              </Box>
            )}
            {listing.isFeatured && (
              <Box pos="absolute" top={6} left={6}>
                <Badge color="dark" variant="filled" size="xs" radius="sm">Премиум</Badge>
              </Box>
            )}
            {!hasDisplayImage && (
              <Box pos="absolute" top={6} right={6}>
                <Badge className="listing-card__media-label" color="gray" variant="white" size="xs" radius="sm">{missingMediaLabel}</Badge>
              </Box>
            )}
          </Box>

          {/* Контент */}
          <Box className="listing-card__row-content" p="sm" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <Stack gap={4}>
              <Group justify="space-between" gap="sm" align="flex-start" wrap="nowrap">
                <Group gap="sm" align="center" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                  {showBrandMark && <BrandIcon brand={listing.vehicle!.make} size={32} variant="rounded" />}
                  <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                    {isVehicle && <Text className="listing-card__row-eyebrow" fz="10px" fw={700}>{vehicleTypeLabel(vehicleType, listing.vehicle!.bodyType)}</Text>}
                    <Text className="listing-card__row-title" fw={700} fz="sm" c="var(--market-ink)" style={TRUNCATE}>{listing.title}</Text>
                    <Text fz="xs" c="gray.5" style={TRUNCATE}>
                      {isVehicle ? `${listing.vehicle!.make} ${listing.vehicle!.model}` : listing.part?.name}
                    </Text>
                  </Stack>
                </Group>
                <Stack gap={2} align="flex-end" style={{ flexShrink: 0 }}>
                  {/* Цена крупнее названия — то же правило, что в плитке. */}
                  <Text className="listing-card__price" fw={800} fz={20} c="var(--market-ink)" ff="var(--font-display), sans-serif" style={{ whiteSpace: "nowrap", letterSpacing: "var(--track-title)", fontVariantNumeric: "tabular-nums" }}>
                    {formatPriceShort(listing.price)}
                  </Text>
                  {/* Кредитная строка убрана: считалась по выдуманной ставке. */}
                </Stack>
              </Group>

              {isVehicle && (
                <Group className="listing-card__row-facts" gap={0} wrap="wrap" mt={2}>
                  <Text fz="xs" c="gray.6">Год <Text component="span" inherit fw={700} c="var(--market-ink)">{listing.vehicle!.year}</Text></Text>
                  {distanceValue && <Text fz="xs" c="gray.6">{usageMeta.label} <Text component="span" inherit fw={700} c="var(--market-ink)">{distanceValue}</Text></Text>}
                  {/* OTHER означает «не указано» — в списке это не факт. */}
                  {supportsTransmission(vehicleType) && listing.vehicle!.transmission && listing.vehicle!.transmission !== "OTHER" && (
                    <Text fz="xs" c="gray.6">КПП <Text component="span" inherit fw={700} c="var(--market-ink)">{findLabel(getTransmissionOptions(vehicleType), listing.vehicle!.transmission)}</Text></Text>
                  )}
                  {listing.vehicle!.fuelType && listing.vehicle!.fuelType !== "OTHER" && (
                    <Text fz="xs" c="gray.6">Топливо <Text component="span" inherit fw={700} c="var(--market-ink)">{findLabel(getFuelOptions(vehicleType), listing.vehicle!.fuelType)}</Text></Text>
                  )}
                  {/* У электротяги объёма нет — там о моторе говорит мощность. */}
                  {listing.vehicle!.fuelType === "ELECTRIC"
                    ? listing.vehicle!.power ? (
                        <Text fz="xs" c="gray.6">Мощность <Text component="span" inherit fw={700} c="var(--market-ink)">{listing.vehicle!.power} л.с.</Text></Text>
                      ) : null
                    : listing.vehicle!.engineVolume ? (
                        <Text fz="xs" c="gray.6">Объём <Text component="span" inherit fw={700} c="var(--market-ink)">{listing.vehicle!.engineVolume} л</Text></Text>
                      ) : null}
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
                {isVehicle && (
                  <ActionIcon
                    className="listing-card__favorite listing-card__favorite--inline"
                    color={inCompare ? "indigo" : "gray"}
                    variant={inCompare ? "filled" : "subtle"}
                    size={44}
                    radius="xl"
                    onClick={handleCompare}
                    aria-label={inCompare ? "Убрать из сравнения" : "Добавить к сравнению"}
                    style={{ position: "relative", zIndex: 2 }}
                  >
                    <IconScale size={14} />
                  </ActionIcon>
                )}
                <ActionIcon
                  className="listing-card__favorite listing-card__favorite--inline"
                  color={isFav ? "red" : "gray"}
                  variant={isFav ? "filled" : "subtle"}
                  /* 44 пикселя — норма зоны нажатия для пальца. При size="sm"
                     кнопка была 30px, и на телефоне в неё промахивались; в
                     карточке каталога это уже исправлено. */
                  size={44}
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
