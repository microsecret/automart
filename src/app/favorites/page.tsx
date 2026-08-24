"use client"
export const dynamic = "force-dynamic"
import useSWR from "swr"
import Link from "next/link"
import { Box, Stack, Group, Text, SimpleGrid, Center, Paper, Button, ThemeIcon, Pagination, SegmentedControl } from "@mantine/core"
import { IconHeartBroken, IconLayoutGrid, IconList } from "@tabler/icons-react"
import { useState } from "react"
import ListingCard from "@/components/listings/ListingCard"
import ListingRow from "@/components/listings/ListingRow"
import type { ListingCardData } from "@/components/listings/ListingCard"
import { fetchJson } from "@/lib/api-client"
import { AsyncErrorState, ResultsGridSkeleton } from "@/components/ui/AsyncStates"
import DashboardNav from "@/components/dashboard/DashboardNav"

type FavoritesResponse = {
  favorites: ListingCardData[]
  pagination: { total: number; pages: number }
}

export default function FavoritesPage() {
  const [page, setPage] = useState(1)
  const [view, setView] = useState("grid")
  const { data, error, isLoading, mutate } = useSWR<FavoritesResponse>(`/api/favorites?page=${page}&limit=18`, fetchJson)

  const favorites = data?.favorites || []

  return (
    <Box p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Stack gap={0}>
            <Group gap="sm" align="center">
              <Text component="h1" c="var(--market-ink)" ff="var(--font-display),sans-serif">Избранное</Text>
            </Group>
            {data && <Text size="xs" c="gray.5">{data.pagination.total} объявлений в избранном</Text>}
          </Stack>
          {favorites.length > 0 && (
            <SegmentedControl size="xs" value={view} onChange={setView} data={[{label:<IconLayoutGrid size={14}/>,value:"grid"},{label:<IconList size={14}/>,value:"list"}]} />
          )}
        </Group>

        <DashboardNav active="favorites" />

        {isLoading ? (
          <ResultsGridSkeleton count={8} mediaHeight={210} />
        ) : error ? (
          <AsyncErrorState title="Не удалось загрузить избранное" description="Проверьте авторизацию и повторите запрос." onRetry={() => mutate()} backHref="/auth/signin" backLabel="Войти" />
        ) : favorites.length === 0 ? (
          <Paper radius="md" p="xl" withBorder>
            <Center>
              <Stack align="center" gap="md">
                <ThemeIcon variant="light" color="gray" size={56} radius="md"><IconHeartBroken size={28} /></ThemeIcon>
                <Stack gap={0} align="center">
                  <Text fw={600} fz="lg" c="var(--market-ink)">В избранном пусто</Text>
                  <Text size="sm" c="gray.5" ta="center">Нажимайте на ♥ в карточках объявлений, чтобы сохранить их здесь</Text>
                </Stack>
                <Button component={Link} href="/" variant="light" color="indigo" size="sm" radius="md">Перейти к объявлениям</Button>
              </Stack>
            </Center>
          </Paper>
        ) : view === "grid" ? (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
            {favorites.map((l) => <ListingCard key={l.id} listing={l} />)}
          </SimpleGrid>
        ) : (
          <Stack gap="xs">{favorites.map((l) => <ListingRow key={l.id} listing={l} />)}</Stack>
        )}

        {data && data.pagination.pages > 1 && (
          <Group justify="center"><Pagination value={page} onChange={setPage} total={data.pagination.pages} size="sm" color="indigo" /></Group>
        )}
      </Stack>
    </Box>
  )
}
