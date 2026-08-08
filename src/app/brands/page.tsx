"use client"
export const dynamic = "force-dynamic"

import { useState } from "react"
import { Container, Stack, Text, Group, SegmentedControl, SimpleGrid, Paper, Anchor, Box } from "@mantine/core"
import Link from "next/link"
import { BRANDS, COUNTRY_FLAGS, TRANSPORT_CATEGORIES } from "@/lib/catalog"
import BrandBadge from "@/components/brands/BrandBadge"
import { getBrandColor, getContrastText } from "@/lib/brand-colors"

const CAT_LABELS: Record<string, string> = {
  cars: "Легковые", moto: "Мото", trucks: "Грузовики", special: "Спецтехника", water: "Водный", air: "Авиа",
}

export default function BrandsPage() {
  const [cat, setCat] = useState<string>("cars")

  const filteredBrands = BRANDS.filter((b) => b.category === cat).sort((a, b) => a.name.localeCompare(b.name, "ru"))

  return (
    <Container size="xl" py="md" px={{ base: "md", md: "lg" }}>
      <Stack gap="md">
        <Stack gap={0}>
          <Text component="h1" ff="var(--font-display),sans-serif" fw={800} fz={{ base: 22, md: 26 }} lh={1.2} c="#18181b">
            Все марки
          </Text>
          <Text size="xs" c="#71717a" mt={2}>{filteredBrands.length} брендов в категории</Text>
        </Stack>

        <SegmentedControl
          value={cat}
          onChange={setCat}
          size="sm"
          radius="md"
          data={[
            { label: "Легковые", value: "cars" },
            { label: "Мото", value: "moto" },
            { label: "Грузовики", value: "trucks" },
            { label: "Спецтехника", value: "special" },
            { label: "Вода", value: "water" },
            { label: "Авиа", value: "air" },
          ]}
        />

        <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing="xs">
          {filteredBrands.map((brand) => (
            <Anchor
              key={brand.name}
              component={Link}
              href={`/search?type=vehicle&make=${encodeURIComponent(brand.name)}`}
              style={{ textDecoration: "none" }}
            >
              <Paper
                radius="md"
                p="sm"
                withBorder
                style={{ borderColor: "#f4f4f5", transition: "all 150ms ease", cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#e4e4e7"; e.currentTarget.style.background = "#fafafa" }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#f4f4f5"; e.currentTarget.style.background = "#fff" }}
              >
                <Group gap="sm" align="center" wrap="nowrap">
                  <Box
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: getBrandColor(brand.name),
                      color: getContrastText(getBrandColor(brand.name)),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontWeight: 700,
                      fontSize: "0.875rem",
                    }}
                  >
                    {brand.name[0]?.toUpperCase()}
                  </Box>
                  <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
                    <Text size="sm" fw={600} c="#18181b" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {brand.name}
                    </Text>
                    <Text size="xs" c="#a1a1aa">{brand.models.length} моделей {COUNTRY_FLAGS[brand.country]}</Text>
                  </Stack>
                </Group>
              </Paper>
            </Anchor>
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
  )
}
