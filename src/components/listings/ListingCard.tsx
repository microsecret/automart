"use client"

import { useState, useTransition, useEffect } from "react"
import { Card, Text, Group, Badge, Box, Stack, ActionIcon, AspectRatio, Menu, Portal, SimpleGrid } from "@mantine/core"
import { IconHeart, IconMapPin } from "@tabler/icons-react"
import Link from "next/link"
import { formatMonthlyPayment, formatPriceShort, formatMileage, formatRelativeDate, parseImages } from "@/lib/format"
import { findLabel, getFuelOptions, getTransmissionOptions, getUsageMeta, supportsTransmission } from "@/lib/constants"
import BrandIcon from "@/components/brands/BrandIcon"
import { hasBrandLogo } from "@/components/brands/BrandLogo"
import VehicleFallback, { vehicleTypeLabel } from "./VehicleFallback"

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
    mileage: number
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
  const [isFav, setIsFav] = useState(false)
  const [activeImg, setActiveImg] = useState(0)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    fetch("/api/favorites").then(r => r.json()).then(d => {
      if (d.favorites) {
        const ids = d.favorites.map((f: { id: string }) => f.id)
        if (ids.includes(listing.id)) setIsFav(true)
      }
    }).catch(() => {})
  }, [listing.id])
  useEffect(() => {
    setActiveImg(0)
    setImageFailed(false)
  }, [listing.id])
  const [pending, startTransition] = useTransition()

  const isVehicle = !!listing.vehicle
  const detailHref = isVehicle
    ? `/listings/vehicle/${listing.vehicle!.id}`
    : `/listings/part/${listing.part!.id}`

  const images = parseImages(isVehicle ? listing.vehicle!.images : listing.part?.images)
  const sourceImage = images[0] || ""
  const image = sourceImage.includes("/placeholder/") ? "" : sourceImage
  const activeImage = images[activeImg] || image
  const displayImage = imageFailed || activeImage.includes("/placeholder/") ? "" : activeImage
  const monthlyPayment = formatMonthlyPayment(listing.price)
  const vehicleType = listing.vehicle?.vehicleType || "CAR"
  const usageMeta = getUsageMeta(vehicleType)
  const usageValue = usageMeta.field === "flightHours" ? listing.vehicle?.flightHours
    : usageMeta.field === "operatingHours" ? listing.vehicle?.operatingHours
    : listing.vehicle?.mileage
  const distanceValue = usageValue == null ? "Не указано"
    : usageMeta.field === "mileage" ? formatMileage(usageValue)
    : `${new Intl.NumberFormat("ru-RU").format(usageValue)} ${usageMeta.unit}`
  const showBrandMark = isVehicle && hasBrandLogo(listing.vehicle!.make)

  const toggleFav = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    startTransition(async () => {
      try {
        await fetch("/api/favorites", {
          method: isFav ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId: listing.id }),
        })
        setIsFav(!isFav)
      } catch {}
    })
  }

  return (
    <Card
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
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#4f46e5"
          e.currentTarget.style.boxShadow = "0 12px 32px -8px rgba(79,70,229,0.25)"
          e.currentTarget.style.transform = "translateY(-3px)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--mantine-color-border)"
          e.currentTarget.style.boxShadow = "none"
          e.currentTarget.style.transform = ""
        }}
      >
        <Link href={detailHref} aria-label={`Открыть объявление: ${listing.title}`} style={{ position: "absolute", inset: 0, zIndex: 1 }} />
        {/* Фото область */}
        <Box pos="relative" style={{ background: "var(--mantine-color-gray-1)", lineHeight: 0 }}>
          <AspectRatio ratio={1}>
            <>
              <VehicleFallback type={isVehicle ? vehicleType : "CAR"} bodyType={listing.vehicle?.bodyType} compact={Boolean(displayImage)} />
              {displayImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayImage} alt={listing.title} onError={() => setImageFailed(true)} style={{ objectFit: "cover", width: "100%", height: "100%", transition: "opacity 200ms ease" }} />
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
              loading={pending}
              aria-label="В избранное"
              style={{ opacity: 0.9 }}
            >
              <IconHeart size={14} fill={isFav ? "currentColor" : "none"} />
            </ActionIcon>
          </Box>
        </Box>

        {/* Текстовая область — чёткое разделение */}
        <Box p="sm">
          {/* Цена + цена в месяц */}
          <Group justify="space-between" align="baseline" mb={4}>
            <Text fw={800} fz="md" lh={1.1} c="dark.9" ff="var(--font-display),sans-serif" style={{ letterSpacing: "-0.01em" }}>
              {formatPriceShort(listing.price)}
            </Text>
            {monthlyPayment && (
              <Text fz="10px" c="gray.5" style={{ whiteSpace: "nowrap" }}>
                {monthlyPayment}
              </Text>
            )}
          </Group>

          {/* Заголовок */}
          <Text fz="xs" c="gray.6" lh={1.4} mb={6} style={TRUNCATE_STYLE}>
            {listing.title}
          </Text>

          {/* Характеристики — сетка с иконками */}
          {isVehicle && (
            <SimpleGrid cols={2} spacing={6} mb={6}>
              <Stack gap={0}>
                <Text fz="9px" c="gray.5" tt="uppercase" fw={700}>Тип</Text>
                <Text fz="11px" c="dark.7" fw={600} style={TRUNCATE_STYLE}>{vehicleTypeLabel(vehicleType, listing.vehicle!.bodyType)}</Text>
              </Stack>
              <Stack gap={0}>
                <Text fz="9px" c="gray.5" tt="uppercase" fw={700}>Год</Text>
                <Text fz="11px" c="dark.7" fw={600} style={TRUNCATE_STYLE}>{listing.vehicle!.year}</Text>
              </Stack>
              <Stack gap={0}>
                <Text fz="9px" c="gray.5" tt="uppercase" fw={700}>{usageMeta.label}</Text>
                <Text fz="11px" c="dark.7" fw={600} style={TRUNCATE_STYLE}>{distanceValue}</Text>
              </Stack>
              {supportsTransmission(vehicleType) && listing.vehicle!.transmission && (
                <Stack gap={0}>
                  <Text fz="9px" c="gray.5" tt="uppercase" fw={700}>Трансмиссия</Text>
                  <Text fz="11px" c="dark.7" fw={600} style={TRUNCATE_STYLE}>{findLabel(getTransmissionOptions(vehicleType), listing.vehicle!.transmission)}</Text>
                </Stack>
              )}
              {listing.vehicle!.fuelType && (
                <Stack gap={0}>
                  <Text fz="9px" c="gray.5" tt="uppercase" fw={700}>Топливо</Text>
                  <Text fz="11px" c="dark.7" fw={600} style={TRUNCATE_STYLE}>{findLabel(getFuelOptions(vehicleType), listing.vehicle!.fuelType)}</Text>
                </Stack>
              )}
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
