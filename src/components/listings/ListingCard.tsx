"use client"

import { useState, useTransition } from "react"
import { Card, Text, Group, Badge, Box, Stack, ActionIcon, AspectRatio, Menu, Portal, SimpleGrid } from "@mantine/core"
import { IconHeart, IconMapPin, IconGauge, IconCalendar, IconManualGearbox, IconGasStation, IconDotsVertical, IconShare } from "@tabler/icons-react"
import Link from "next/link"
import { formatPriceShort, formatMileage, formatRelativeDate, parseImages } from "@/lib/format"
import { findLabel, BODY_TYPES, FUEL_TYPES, TRANSMISSIONS } from "@/lib/constants"
import BrandLogo from "@/components/brands/BrandLogo"
import BrandBadge from "@/components/brands/BrandBadge"

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
    fuelType: string | null
    transmission: string | null
    bodyType: string | null
    images: string | null
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
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#e4e4e7"
          e.currentTarget.style.boxShadow = "0 6px 20px -6px rgba(0,0,0,0.08)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#f4f4f5"
          e.currentTarget.style.boxShadow = "none"
        }}
      >
        {/* Фото область */}
        <Box pos="relative" style={{ background: "#f4f4f5", lineHeight: 0 }}>
          <AspectRatio ratio={4 / 3}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={listing.title} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
          </AspectRatio>

          {/* Бейдж Премиум — слева сверху */}
          {listing.isFeatured && (
            <Box pos="absolute" top={8} left={8}>
              <Badge color="dark" variant="filled" size="sm" radius="sm">Премиум</Badge>
            </Box>
          )}

          {/* Цветной лейбл бренда — справа сверху */}
          {isVehicle && (
            <Box pos="absolute" top={8} right={8} style={{ borderRadius: 4, overflow: "hidden" }}>
              <BrandBadge brand={listing.vehicle!.make} size="xs" />
            </Box>
          )}

          {/* Сердечко — справа снизу */}
          <Box pos="absolute" bottom={8} right={8}>
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
            <Text fw={800} fz="md" lh={1.1} c="#18181b" ff="var(--font-display),sans-serif" style={{ letterSpacing: "-0.01em" }}>
              {formatPriceShort(listing.price)}
            </Text>
            {listing.price && listing.price > 100000 && (
              <Text fz="10px" c="#71717a" style={{ whiteSpace: "nowrap" }}>
                от {Math.round(listing.price * 0.025 / 1000)}к/мес
              </Text>
            )}
          </Group>

          {/* Заголовок */}
          <Text fz="xs" c="#52525b" lh={1.4} mb={6} style={TRUNCATE_STYLE}>
            {listing.title}
          </Text>

          {/* Характеристики — сетка с иконками */}
          {isVehicle && (
            <SimpleGrid cols={2} spacing={4} mb={6}>
              <Group gap={3} wrap="nowrap">
                <IconCalendar size={11} stroke={1.8} color="#a1a1aa" style={{ flexShrink: 0 }} />
                <Text fz="10px" c="#71717a" style={TRUNCATE_STYLE}>{listing.vehicle!.year}</Text>
              </Group>
              <Group gap={3} wrap="nowrap">
                <IconGauge size={11} stroke={1.8} color="#a1a1aa" style={{ flexShrink: 0 }} />
                <Text fz="10px" c="#71717a" style={TRUNCATE_STYLE}>{formatMileage(listing.vehicle!.mileage)}</Text>
              </Group>
              {listing.vehicle!.transmission && (
                <Group gap={3} wrap="nowrap">
                  <IconManualGearbox size={11} stroke={1.8} color="#a1a1aa" style={{ flexShrink: 0 }} />
                  <Text fz="10px" c="#71717a" style={TRUNCATE_STYLE}>{findLabel(TRANSMISSIONS, listing.vehicle!.transmission)}</Text>
                </Group>
              )}
              {listing.vehicle!.fuelType && (
                <Group gap={3} wrap="nowrap">
                  <IconGasStation size={11} stroke={1.8} color="#a1a1aa" style={{ flexShrink: 0 }} />
                  <Text fz="10px" c="#71717a" style={TRUNCATE_STYLE}>{findLabel(FUEL_TYPES, listing.vehicle!.fuelType)}</Text>
                </Group>
              )}
            </SimpleGrid>
          )}

          {/* Низ — город и дата */}
          <Group justify="space-between" gap={4} mt={6} pt={6} style={{ borderTop: "1px solid #f4f4f5" }}>
            {listing.location ? (
              <Group gap={3} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                <IconMapPin size={11} stroke={1.8} color="#a1a1aa" style={{ flexShrink: 0 }} />
                <Text fz="xs" c="#a1a1aa" style={TRUNCATE_STYLE}>{listing.location}</Text>
              </Group>
            ) : <span />}
            {listing.createdAt && (
              <Text fz="xs" c="#a1a1aa" style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                {formatRelativeDate(listing.createdAt)}
              </Text>
            )}
          </Group>
        </Box>
      </Card>
    </Link>
  )
}
