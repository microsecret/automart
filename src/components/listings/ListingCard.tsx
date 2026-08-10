"use client"

import { useState, useEffect } from "react"
import { Card, Text, Group, Badge, Box, ActionIcon, AspectRatio, SimpleGrid } from "@mantine/core"
import { IconHeart, IconMapPin } from "@tabler/icons-react"
import Link from "next/link"
import { formatMonthlyPayment, formatPriceShort, formatMileage, formatRelativeDate, parseImages } from "@/lib/format"
import { findLabel, getFuelOptions, getTransmissionOptions, getUsageMeta, supportsTransmission } from "@/lib/constants"
import BrandIcon from "@/components/brands/BrandIcon"
import { hasBrandLogo } from "@/components/brands/BrandLogo"
import VehicleFallback, { vehicleTypeLabel } from "./VehicleFallback"
import { useFavorites } from "@/hooks/useFavorites"
import { useRouter } from "next/navigation"
import { notifications } from "@mantine/notifications"

export interface ListingCardData {
  id: string
  title: string
  price: number | null
  isFeatured?: boolean
  createdAt?: string | Date
  location?: string | null
  views?: number
  vehicle?: {
    id: string
    make: string
    model: string
    year: number
    mileage: number | null
    operatingHours?: number | null
    flightHours?: number | null
    fuelType: string | null
    transmission: string | null
    bodyType: string | null
    images: string | null
    vehicleType?: string | null
    typeDetails?: string | null
  } | null
  part?: {
    id: string
    name: string
    price: number
    condition: string | null
    partType: string | null
    images: string | null
  } | null
}

const TRUNCATE_STYLE: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  display: "block",
  maxWidth: "100%",
}

export default function ListingCard({ listing }: { listing: ListingCardData }) {
  const [activeImg, setActiveImg] = useState(0)
  const [imageFailed, setImageFailed] = useState(false)
  const router = useRouter()
  const { favoriteIds, isAuthenticated, isPending, toggleFavorite } = useFavorites()
  useEffect(() => {
    setActiveImg(0)
    setImageFailed(false)
  }, [listing.id])
  const isVehicle = !!listing.vehicle
  const detailHref = isVehicle
    ? `/listings/vehicle/${listing.vehicle!.id}`
    : `/listings/part/${listing.part!.id}`

  const images = parseImages(isVehicle ? listing.vehicle!.images : listing.part?.images)
  const sourceImage = images[0] || ""
  const image = sourceImage.includes("/placeholder/") ? "" : sourceImage
  const activeImage = images[activeImg] || image
  const displayImage = imageFailed || activeImage.includes("/placeholder/") ? "" : activeImage
  const hasDisplayImage = Boolean(displayImage)
  const monthlyPayment = formatMonthlyPayment(listing.price)
  const vehicleType = listing.vehicle?.vehicleType || "CAR"
  const usageMeta = getUsageMeta(vehicleType)
  const usageValue = usageMeta.field === "flightHours" ? listing.vehicle?.flightHours
    : usageMeta.field === "operatingHours" ? listing.vehicle?.operatingHours
    : listing.vehicle?.mileage
  const numericUsage = typeof usageValue === "number" && Number.isFinite(usageValue) ? usageValue : null
  const distanceValue = numericUsage == null ? "Не указано"
    : usageMeta.field === "mileage" ? formatMileage(numericUsage)
    : `${new Intl.NumberFormat("ru-RU").format(numericUsage)} ${usageMeta.unit}`
  const showBrandMark = isVehicle && hasBrandLogo(listing.vehicle!.make)
  const isFav = favoriteIds.has(listing.id)
  const missingMediaLabel = isVehicle
    ? `${vehicleTypeLabel(vehicleType, listing.vehicle?.bodyType)} · без фото`
    : "Запчасть · без фото"

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
        className="listing-card"
        pos="relative"
        padding={0}
        radius="lg"
        withBorder
        style={{
          overflow: "hidden",
          borderColor: "var(--mantine-color-border)",
          transition: "border-color 200ms ease, box-shadow 200ms ease",
          cursor: "pointer",
        }}
      >
        <Link href={detailHref} aria-label={`Открыть объявление: ${listing.title}`} style={{ position: "absolute", inset: 0, zIndex: 1 }} />
        {/* Фото область */}
        <Box
          className="listing-card__media"
          data-empty-media={!hasDisplayImage || undefined}
          data-vehicle-type={isVehicle ? vehicleType.toLowerCase() : "part"}
          pos="relative"
          style={{ background: "var(--mantine-color-gray-1)", lineHeight: 0 }}
        >
          <AspectRatio ratio={hasDisplayImage ? 8 / 5 : 8 / 3}>
            <>
              <VehicleFallback type={isVehicle ? vehicleType : "CAR"} bodyType={listing.vehicle?.bodyType} compact={!hasDisplayImage} />
              {displayImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayImage} alt={listing.title} onError={() => setImageFailed(true)} loading="lazy" decoding="async" style={{ objectFit: "cover", width: "100%", height: "100%", transition: "opacity 200ms ease" }} />
              )}
            </>
          </AspectRatio>
          {images.length > 1 && (
            <>
              {/* Точки навигации */}
              <Box pos="absolute" bottom={6} left={0} right={0} style={{ display: "flex", justifyContent: "center", gap: 4 }}>
                {images.slice(0, 5).map((_, i) => (
                  <ActionIcon
                    key={i}
                    onClick={() => { setActiveImg(i); setImageFailed(false) }}
                    aria-label={`Фото ${i + 1}`}
                    variant="transparent"
                    style={{
                      position: "relative",
                      zIndex: 2,
                      width: i === activeImg ? 16 : 6,
                      height: 6,
                      minWidth: i === activeImg ? 16 : 6,
                      minHeight: 6,
                      padding: 0,
                      borderRadius: 3,
                      background: i === activeImg ? "#fff" : "rgba(255,255,255,0.5)",
                      cursor: "pointer",
                      transition: "all 200ms ease",
                    }}
                  />
                ))}
              </Box>
              {/* Счётчик фото */}
              <Box pos="absolute" top={8} left={listing.isFeatured ? 76 : 8} style={{ background: "rgba(0,0,0,0.6)", borderRadius: 4, padding: "2px 6px", zIndex: 2 }}>
                <Text fz={10} c="white" fw={500}>{activeImg + 1}/{images.length}</Text>
              </Box>
            </>
          )}

          {/* Бейдж Премиум — слева сверху */}
          {listing.isFeatured && (
            <Box pos="absolute" top={8} left={8} style={{ zIndex: 2 }}>
              <Badge color="dark" variant="filled" size="sm" radius="sm">Премиум</Badge>
            </Box>
          )}

          {!hasDisplayImage && (
            <Box pos="absolute" top={8} left={listing.isFeatured ? 76 : 8} style={{ zIndex: 2 }}>
              <Badge color="gray" variant="white" size="xs" radius="sm">{missingMediaLabel}</Badge>
            </Box>
          )}

          {/* Цветная иконка бренда — справа сверху */}
          {showBrandMark && (
            <Box pos="absolute" top={8} right={8} style={{ zIndex: 2 }}>
              <BrandIcon brand={listing.vehicle!.make} size={28} variant="rounded" />
            </Box>
          )}

          {/* Сердечко — справа снизу */}
          <Box pos="absolute" bottom={8} right={8} style={{ zIndex: 2 }}>
            <ActionIcon
              color={isFav ? "red" : "dark"}
              variant="filled"
              size="sm"
              radius="xl"
              onClick={toggleFav}
              loading={isPending(listing.id)}
              aria-label={isFav ? "Убрать из избранного" : "Добавить в избранное"}
              style={{ opacity: 0.9 }}
            >
              <IconHeart size={14} fill={isFav ? "currentColor" : "none"} />
            </ActionIcon>
          </Box>
        </Box>

        {/* Текстовая область — чёткое разделение */}
        <Box p="sm" className="listing-card__content">
          {/* Цена + цена в месяц */}
          <Group justify="space-between" align="baseline" mb={4}>
            <Text className="listing-card__price" fw={800} fz="md" lh={1.1} c="dark.9" ff="var(--font-display),sans-serif" style={{ letterSpacing: "-0.01em" }}>
              {formatPriceShort(listing.price)}
            </Text>
            {monthlyPayment && (
              <Text className="listing-card__monthly-payment" fz="10px" c="gray.5" style={{ whiteSpace: "nowrap" }}>
                {monthlyPayment}
              </Text>
            )}
          </Group>

          {/* Заголовок */}
          <Text className="listing-card__title" fz="sm" fw={700} c="dark.9" lh={1.35} mb={7} style={TRUNCATE_STYLE}>
            {listing.title}
          </Text>

          {/* Краткие факты: без капслока и повторения типа категории. */}
          {isVehicle && (
            <SimpleGrid cols={2} spacing={4} mb={6} className="listing-card__facts">
              <Text className="listing-card__fact" fz="xs" c="gray.6">Год <Text component="span" inherit fw={700} c="dark.8">{listing.vehicle!.year}</Text></Text>
              {numericUsage != null && <Text className="listing-card__fact" fz="xs" c="gray.6">{usageMeta.label} <Text component="span" inherit fw={700} c="dark.8">{distanceValue}</Text></Text>}
              {supportsTransmission(vehicleType) && listing.vehicle!.transmission && <Text className="listing-card__fact" fz="xs" c="gray.6">КПП <Text component="span" inherit fw={700} c="dark.8">{findLabel(getTransmissionOptions(vehicleType), listing.vehicle!.transmission)}</Text></Text>}
              {listing.vehicle!.fuelType && <Text className="listing-card__fact" fz="xs" c="gray.6">Топливо <Text component="span" inherit fw={700} c="dark.8">{findLabel(getFuelOptions(vehicleType), listing.vehicle!.fuelType)}</Text></Text>}
            </SimpleGrid>
          )}

          {/* Низ — город и дата */}
          <Group justify="space-between" gap={4} mt={6} pt={6} style={{ borderTop: "1px solid var(--mantine-color-border)" }}>
            {listing.location ? (
              <Group gap={3} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                <IconMapPin size={11} stroke={1.8} color="gray.4" style={{ flexShrink: 0 }} />
                <Text fz="xs" c="gray.4" style={TRUNCATE_STYLE}>{listing.location}</Text>
              </Group>
            ) : <span />}
            {listing.createdAt && (
              <Text fz="xs" c="gray.4" style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                {formatRelativeDate(listing.createdAt)}
              </Text>
            )}
          </Group>
        </Box>
      </Card>
  )
}
