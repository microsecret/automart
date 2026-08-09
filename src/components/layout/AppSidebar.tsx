"use client"

import { ScrollArea, NavLink, Text, Stack, Group, Box, Divider } from "@mantine/core"
import {
  IconCar,
  IconMotorbike,
  IconTruck,
  IconTractor,
  IconSpeedboat,
  IconTools,
  IconBuildingStore,
} from "@tabler/icons-react"
import Link from "next/link"
import { POPULAR_BRANDS, COUNTRY_FLAGS } from "@/lib/catalog"

const NAV_ITEMS = [
  { slug: "cars", label: "Легковые", icon: <IconCar size={17} stroke={1.8} /> },
  { slug: "moto", label: "Мото", icon: <IconMotorbike size={17} stroke={1.8} /> },
  { slug: "trucks", label: "Грузовики", icon: <IconTruck size={17} stroke={1.8} /> },
  { slug: "special", label: "Спецтехника", icon: <IconTractor size={17} stroke={1.8} /> },
  { slug: "water", label: "Водный транспорт", icon: <IconSpeedboat size={17} stroke={1.8} /> },
  { slug: "parts", label: "Запчасти", icon: <IconTools size={17} stroke={1.8} /> },
  { slug: "services", label: "Услуги", icon: <IconBuildingStore size={17} stroke={1.8} /> },
]

export default function AppSidebar() {
  return (
    <Box
      component="nav"
      style={{
        height: "100%",
        background: "var(--mantine-color-body)",
        borderRight: "1px solid var(--mantine-color-border)",
      }}
    >
      <ScrollArea h="100%" type="hover" offsetScrollbars scrollbarSize={6}>
        <Stack gap={0} p="sm">
          {/* Категории */}
          <Text
            size="10px"
            fw={700}
            c="gray.4"
            px="sm"
            pt="md"
            pb="xs"
            ff="var(--font-display), sans-serif"
            style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            Категории
          </Text>

          <Stack gap={2}>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.slug}
                component={Link}
                href={`/category/${item.slug}`}
                label={
                  <Text size="sm" c="dark.7" fw={500}>
                    {item.label}
                  </Text>
                }
                leftSection={item.icon}
              />
            ))}
          </Stack>

          <Divider my="sm" color="gray.2" />

          {/* Популярные бренды */}
          <Group justify="space-between" px="sm" pb="xs">
            <Text
              size="10px"
              fw={700}
              c="gray.4"
              ff="var(--font-display), sans-serif"
              style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
            >
              Марки
            </Text>
          </Group>

          <Stack gap={1}>
            {POPULAR_BRANDS.slice(0, 22).map((brand) => (
              <NavLink
                key={brand.name}
                component={Link}
                href={`/search?type=vehicle&make=${encodeURIComponent(brand.name)}`}
                label={
                  <Group gap={8} wrap="nowrap" align="center">
                    <Text size="sm" c="dark.7" fw={500} className="line-clamp-1">
                      {brand.name}
                    </Text>
                    <Text size="xs" ml="auto" style={{ opacity: 0.7 }}>
                      {COUNTRY_FLAGS[brand.country]}
                    </Text>
                  </Group>
                }
              />
            ))}
          </Stack>

          <NavLink
            component={Link}
            href="/brands"
            label={<Text size="sm" c="#4f46e5" fw={600}>Все марки →</Text>}
            mt="xs"
          />
        </Stack>
      </ScrollArea>
    </Box>
  )
}
