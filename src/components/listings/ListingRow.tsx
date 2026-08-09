"use client"

import { useState, useTransition, useEffect } from "react"
import { Card, Text, Group, Badge, Box, Stack, ActionIcon, AspectRatio } from "@mantine/core"
import { IconHeart, IconMapPin } from "@tabler/icons-react"
import Link from "next/link"
import { formatPriceShort, formatMileage, formatRelativeDate, parseImages } from "@/lib/format"
import { findLabel, FUEL_TYPES, TRANSMISSIONS } from "@/lib/constants"
import BrandIcon from "@/components/brands/BrandIcon"
import { hasBrandLogo } from "@/components/brands/BrandLogo"
import VehicleFallback, { vehicleTypeLabel } from "./VehicleFallback"
import type { ListingCardData } from "./ListingCard"

export type ListingRowData = ListingCardData

const TRUNCATE: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  display: "block",
  maxWidth: "100%",
}

export default function ListingRow({ listing }: { listing: ListingRowData }) {
  const [isFav, setIsFav] = useState(false)

  useEffect(() => {
    fetch("/api/favorites").then(r => r.json()).then(d => {
      if (d.favorites) {
        const ids = d.favorites.map(f => f.id)
        if (ids.includes(listing.id)) setIsFav(true)
      }
    }).catch(() => {})
  }, [listing.id])
  const [pending, startTransition] = useTransition()

  const isVehicle = !!listing.vehicle
  const detailHref = isVehicle
    ? `/listings/vehicle/${listing.vehicle!.id}`
    : `/listings/part/${listing.part!.id}`

  const images = parseImages(isVehicle ? listing.vehicle!.images : listing.part?.images)
  const sourceImage = images[0] || ""
  const image = sourceImage.includes("/placeholder/") ? "" : sourceImage
  const vehicleType = listing.vehicle?.vehicleType || "CAR"
  const isAir = vehicleType === "AIR"
  const distanceLabel = isAir ? "Налёт" : "Пробег"
  const distanceValue = isAir
    ? `${new Intl.NumberFormat("ru-RU").format(listing.vehicle?.mileage || 0)} ч`
    : formatMileage(listing.vehicle?.mileage)
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
    <Link href={detailHref} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <Card
        padding={0}
        radius="md"
        withBorder
        style={{
          overflow: "hidden",
          borderColor: "var(--mantine-color-border)",
          transition: "border-color 200ms ease, box-shadow 200ms ease",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#4f46e5"; e.currentTarget.style.boxShadow = "0 8px 24px -6px rgba(79,70,229,0.2)"; e.currentTarget.style.transform = "translateY(-2px)" }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--mantine-color-border)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "" }}
      >
        <Group gap={0} align="stretch" wrap="nowrap">
          {/* Фото */}
          <Box pos="relative" style={{ width: 180, flexShrink: 0, background: "var(--mantine-color-gray-1)", lineHeight: 0 }}>
            {image ? (
              <AspectRatio ratio={4 / 3} w={180}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={listing.title} onError={(e) => { e.currentTarget.style.display = "none" }} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
              </AspectRatio>
            ) : (
              <Box h="100%"><VehicleFallback type={isVehicle ? vehicleType : "CAR"} bodyType={listing.vehicle?.bodyType} compact /></Box>
            )}
            {listing.isFeatured && (
              <Box pos="absolute" top={6} left={6}>
                <Badge color="dark" variant="filled" size="xs" radius="sm">Премиум</Badge>
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
                  <Text fz="xs" c="gray.5">{vehicleTypeLabel(vehicleType, listing.vehicle!.bodyType)}</Text>
                  <Text fz="xs" c="gray.5">Год: {listing.vehicle!.year}</Text>
                  <Text fz="xs" c="gray.5">{distanceLabel}: {distanceValue}</Text>
                  {listing.vehicle!.transmission && (
                    <Text fz="xs" c="gray.5">КПП: {findLabel(TRANSMISSIONS, listing.vehicle!.transmission)}</Text>
                  )}
                  {listing.vehicle!.fuelType && (
                    <Text fz="xs" c="gray.5">Топливо: {findLabel(FUEL_TYPES, listing.vehicle!.fuelType)}</Text>
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
                  loading={pending}
                  aria-label="В избранное"
                >
                  <IconHeart size={14} fill={isFav ? "currentColor" : "none"} />
                </ActionIcon>
              </Group>
            </Group>
          </Box>
        </Group>
      </Card>
    </Link>
  )
}
