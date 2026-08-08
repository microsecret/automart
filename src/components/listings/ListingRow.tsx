"use client"

import { useState, useTransition } from "react"
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
  const [pending, startTransition] = useTransition()

  const isVehicle = !!listing.vehicle
  const detailHref = isVehicle
    ? `/listings/vehicle/${listing.vehicle!.id}`
    : `/listings/part/${listing.part!.id}`

  const images = parseImages(isVehicle ? listing.vehicle!.images : listing.part?.images)
  const image = images[0] || "/placeholder.svg"

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
          borderColor: "#f4f4f5",
          transition: "border-color 200ms ease, box-shadow 200ms ease",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#e4e4e7"; e.currentTarget.style.boxShadow = "0 4px 12px -4px rgba(0,0,0,0.06)" }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#f4f4f5"; e.currentTarget.style.boxShadow = "none" }}
      >
        <Group gap={0} align="stretch" wrap="nowrap">
          {/* Фото */}
          <Box pos="relative" style={{ width: 180, flexShrink: 0, background: "#f4f4f5", lineHeight: 0 }}>
            <AspectRatio ratio={4 / 3} w={180}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt={listing.title} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
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
                  <Text fw={500} fz="sm" c="#3f3f46" style={TRUNCATE}>{listing.title}</Text>
                  <Text fz="xs" c="#a1a1aa" style={TRUNCATE}>
                    {isVehicle ? `${listing.vehicle!.make} ${listing.vehicle!.model}` : listing.part?.name}
                  </Text>
                  </Stack>
                </Group>
                <Text fw={700} fz="md" c="#18181b" ff="var(--font-display), sans-serif" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                  {formatPriceShort(listing.price)}
                </Text>
              </Group>

              {isVehicle && (
                <Group gap={12} wrap="nowrap" mt={2}>
                  <Group gap={3} wrap="nowrap">
                    <IconCalendar size={12} stroke={1.8} color="#a1a1aa" />
                    <Text fz="xs" c="#71717a">{listing.vehicle!.year}</Text>
                  </Group>
                  <Group gap={3} wrap="nowrap">
                    <IconGauge size={12} stroke={1.8} color="#a1a1aa" />
                    <Text fz="xs" c="#71717a">{formatMileage(listing.vehicle!.mileage)}</Text>
                  </Group>
                  {listing.vehicle!.bodyType && (
                    <Text fz="xs" c="#71717a">{findLabel(BODY_TYPES, listing.vehicle!.bodyType)}</Text>
                  )}
                  {listing.vehicle!.transmission && (
                    <Group gap={3} wrap="nowrap">
                      <IconManualGearbox size={12} stroke={1.8} color="#a1a1aa" />
                      <Text fz="xs" c="#71717a">{findLabel(TRANSMISSIONS, listing.vehicle!.transmission)}</Text>
                    </Group>
                  )}
                  {listing.vehicle!.fuelType && (
                    <Group gap={3} wrap="nowrap">
                      <IconGasStation size={12} stroke={1.8} color="#a1a1aa" />
                      <Text fz="xs" c="#71717a">{findLabel(FUEL_TYPES, listing.vehicle!.fuelType)}</Text>
                    </Group>
                  )}
                </Group>
              )}
            </Stack>

            <Group justify="space-between" gap={4} mt={4}>
              {listing.location ? (
                <Group gap={3} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                  <IconMapPin size={11} stroke={1.8} color="#a1a1aa" style={{ flexShrink: 0 }} />
                  <Text fz="xs" c="#a1a1aa" style={TRUNCATE}>{listing.location}</Text>
                </Group>
              ) : <span />}
              <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
                {listing.createdAt && <Text fz="xs" c="#a1a1aa">{formatRelativeDate(listing.createdAt)}</Text>}
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
