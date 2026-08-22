"use client"
export const dynamic = "force-dynamic"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Container, Center, Loader, Group, Text, Breadcrumbs, Anchor, Badge } from "@mantine/core"
import Link from "next/link"
import HomePage from "@/components/catalog/HomeCatalog"
import { IconSearch } from "@tabler/icons-react"
import { PART_TYPES } from "@/lib/constants"

function SearchContent() {
  const sp = useSearchParams()
  const q = sp.get("q") || undefined
  const type = sp.get("type") || undefined
  const make = sp.get("make") || undefined
  const partType = sp.get("partType") || undefined
  const vehicleType = sp.get("vehicleType") || undefined

  const isPart = type === "part" || !!partType
  const partTypeLabel = PART_TYPES.find((item) => item.value === partType)?.label
  const pageTitle = make
    ? `${make} — результаты поиска`
    : isPart
    ? `${partTypeLabel || "Запчасти"} — поиск`
    : q
    ? `Поиск: «${q}»`
    : "Результаты поиска"

  return (
    <Container size="xl" p={{ base: "sm", md: 0 }}>
      <Breadcrumbs mb="sm" separator="›">
        <Anchor component={Link} href="/" size="xs" c="gray.5">Главная</Anchor>
        <Text size="xs" c="gray.6">{pageTitle}</Text>
      </Breadcrumbs>

      <Group gap="sm" align="center" mb="sm">
        <IconSearch size={20} color="#4f46e5" />
        <Text component="h1" fw={800} fz={20} c="var(--market-ink)" ff="var(--font-display),sans-serif">{pageTitle}</Text>
        {isPart && <Badge size="sm" color="indigo" variant="light">{partTypeLabel || "Запчасти"}</Badge>}
        {vehicleType && <Badge size="sm" color="violet" variant="light">{vehicleType}</Badge>}
      </Group>

      <HomePage
        key={`${type}-${make}-${q}-${partType}`}
        initialQuery={q}
        initialMake={make}
        initialPartType={partType}
        initialType={isPart ? "part" : "vehicle"}
        initialVehicleType={vehicleType}
        pageTitle={pageTitle}
        showHero={false}
        showHeading={false}
      />
    </Container>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<Container py={80}><Center><Loader size="sm" color="indigo" /></Center></Container>}>
      <SearchContent />
    </Suspense>
  )
}
