"use client"
export const dynamic = "force-dynamic"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Container, Center, Loader, Group, Text, Breadcrumbs, Anchor, Badge } from "@mantine/core"
import Link from "next/link"
import HomePage from "@/components/catalog/HomeCatalog"
import { IconSearch } from "@tabler/icons-react"

function SearchContent() {
  const sp = useSearchParams()
  const q = sp.get("q") || undefined
  const type = sp.get("type") || undefined
  const make = sp.get("make") || undefined
  const partType = sp.get("partType") || undefined
  const vehicleType = sp.get("vehicleType") || undefined

  const isPart = type === "part" || !!partType
  const pageTitle = make
    ? `${make} — результаты поиска`
    : isPart
    ? "Запчасти — поиск"
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
        <Text component="h1" fw={800} fz={20} c="dark.9" ff="var(--font-display),sans-serif">{pageTitle}</Text>
        {isPart && <Badge size="sm" color="indigo" variant="light">Запчасти</Badge>}
        {vehicleType && <Badge size="sm" color="violet" variant="light">{vehicleType}</Badge>}
      </Group>

      <HomePage
        key={`${type}-${make}-${q}-${partType}`}
        initialQuery={q}
        initialType={isPart ? "part" : "vehicle"}
        initialVehicleType={vehicleType}
        pageTitle={pageTitle}
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
