"use client"
export const dynamic = "force-dynamic"
import useSWR from "swr"
import Link from "next/link"
import { Box, Stack, Group, Text, SimpleGrid, Center, Loader, Paper, Button, ThemeIcon, Pagination, SegmentedControl } from "@mantine/core"
import { IconHeart, IconHeartBroken } from "@tabler/icons-react"
import { useState } from "react"
import ListingCard from "@/components/listings/ListingCard"
import ListingRow from "@/components/listings/ListingRow"

const fetcher = (url) => fetch(url).then((r) => r.json())

export default function FavoritesPage() {
  const [page, setPage] = useState(1)
  const [view, setView] = useState("grid")
  const { data, isLoading } = useSWR(`/api/favorites?page=${page}&limit=18`, fetcher)

  const favorites = data?.favorites || []

  return (
    <Box p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Stack gap={0}>
            <Group gap="sm" align="center">
              <ThemeIcon variant="light" color="red" size={36} radius="md"><IconHeart size={20} fill="currentColor" /></ThemeIcon>
              <Text component="h1" fw={800} fz={22} c="dark.9" ff="var(--font-display),sans-serif">Избранное</Text>
            </Group>
            {data && <Text size="xs" c="gray.5">{data.pagination.total} объявлений в избранном</Text>}
          </Stack>
          {favorites.length > 0 && (
            <SegmentedControl size="xs" value={view} onChange={setView} data={[{label:"▦",value:"grid"},{label:"☰",value:"list"}]} />
          )}
        </Group>

        {isLoading ? (
          <Center py={80}><Loader size="sm" color="indigo" /></Center>
        ) : favorites.length === 0 ? (
          <Paper radius="md" p="xl" withBorder>
            <Center>
              <Stack align="center" gap="md">
                <ThemeIcon variant="light" color="gray" size={56} radius="md"><IconHeartBroken size={28} /></ThemeIcon>
                <Stack gap={0} align="center">
                  <Text fw={600} fz="lg" c="dark.9">В избранном пусто</Text>
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
