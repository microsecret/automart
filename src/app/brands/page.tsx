"use client"
export const dynamic = "force-dynamic"

import { useState } from "react"
import { Container, Stack, Text, Group, SegmentedControl, SimpleGrid, Paper, Anchor } from "@mantine/core"
import Link from "next/link"
import { BRANDS, COUNTRY_FLAGS } from "@/lib/catalog"
import BrandIcon from "@/components/brands/BrandIcon"

export default function BrandsPage() {
  const [cat, setCat] = useState<string>("cars")

  const filteredBrands = BRANDS.filter((b) => b.category === cat).sort((a, b) => a.name.localeCompare(b.name, "ru"))

  return (
    <Container size="xl" py="md" px={{ base: "md", md: "lg" }}>
      <Stack gap="md">
        <Stack gap={0}>
          <Text component="h1" ff="var(--font-display),sans-serif" fw={800} fz={{ base: 22, md: 26 }} lh={1.2} c="var(--market-ink)">
            Все марки
          </Text>
          <Text size="xs" c="gray.5" mt={2}>{filteredBrands.length} брендов в категории</Text>
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
              {/* Наведение описано в CSS-классе: прежний JS-обработчик оставлял
                  на карточке белый фон, который в тёмной теме уже не снимался. */}
              <Paper
                radius="md"
                p="sm"
                withBorder
                className="market-linked-card market-linked-card--flat"
                style={{ cursor: "pointer" }}
              >
                <Group gap="sm" align="center" wrap="nowrap">
<BrandIcon brand={brand.name} size={40} variant="rounded" />
                  <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
                    <Text size="sm" fw={600} c="var(--market-ink)" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {brand.name}
                    </Text>
                    <Text size="xs" c="gray.4">{brand.models.length} моделей {COUNTRY_FLAGS[brand.country]}</Text>
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
