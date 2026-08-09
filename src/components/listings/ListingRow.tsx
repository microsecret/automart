"use client"

import { useState, useTransition, useEffect } from "react"
import { Card, Text, Group, Badge, Box, Stack, ActionIcon, AspectRatio } from "@mantine/core"
import { IconHeart, IconMapPin, IconGauge, IconCalendar, IconManualGearbox, IconGasStation } from "@tabler/icons-react"
import Link from "next/link"
import { formatPrice, formatPriceShort, formatMileage, formatRelativeDate, parseImages } from "@/lib/format"
import { findLabel, BODY_TYPES, FUEL_TYPES, TRANSMISSIONS } from "@/lib/constants"
import BrandLogo from "@/components/brands/BrandLogo"
import BrandIcon from "@/components/brands/BrandIcon"
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
  const fallbackImage = isVehicle ? "/images/home/listing-fallback.png" : "/placeholder.svg"
  const sourceImage = images[0] || ""
  const image = sourceImage.includes("/placeholder/") ? fallbackImage : sourceImage || fallbackImage

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
            <AspectRatio ratio={4 / 3} w={180}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.includes("/placeholder/") ? fallbackImage : image} alt={listing.title} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = fallbackImage }} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
            </AspectRatio>
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
                  {isVehicle && <BrandIcon brand={listing.vehicle!.make} size={32} variant="rounded" />}
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
                <Group gap={12} wrap="nowrap" mt={2}>
                  <Group gap={3} wrap="nowrap">
                    <IconCalendar size={12} stroke={1.8} color="gray.4" />
                    <Text fz="xs" c="gray.5">{listing.vehicle!.year}</Text>
                  </Group>
                  <Group gap={3} wrap="nowrap">
                    <IconGauge size={12} stroke={1.8} color="gray.4" />
                    <Text fz="xs" c="gray.5">{formatMileage(listing.vehicle!.mileage)}</Text>
                  </Group>
                  {listing.vehicle!.bodyType && (
                    <Text fz="xs" c="gray.5">{findLabel(BODY_TYPES, listing.vehicle!.bodyType)}</Text>
                  )}
                  {listing.vehicle!.transmission && (
                    <Group gap={3} wrap="nowrap">
                      <IconManualGearbox size={12} stroke={1.8} color="gray.4" />
                      <Text fz="xs" c="gray.5">{findLabel(TRANSMISSIONS, listing.vehicle!.transmission)}</Text>
                    </Group>
                  )}
                  {listing.vehicle!.fuelType && (
                    <Group gap={3} wrap="nowrap">
                      <IconGasStation size={12} stroke={1.8} color="gray.4" />
                      <Text fz="xs" c="gray.5">{findLabel(FUEL_TYPES, listing.vehicle!.fuelType)}</Text>
                    </Group>
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
