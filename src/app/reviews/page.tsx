"use client"
export const dynamic = "force-dynamic"
import useSWR from "swr"
import Link from "next/link"
import { Box, Stack, Group, Text, Paper, Center, Loader, ThemeIcon, Avatar, SimpleGrid, Rating, Divider } from "@mantine/core"
import { IconStar, IconMessage2 } from "@tabler/icons-react"
import { formatRelativeDate } from "@/lib/format"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function StarsRow({ rating }: { rating: number }) {
  return <Rating value={rating} readOnly size="sm" />
}

export default function ReviewsPage() {
  const { data, isLoading } = useSWR("/api/reviews?limit=50", fetcher)

  const reviews: any[] = data?.reviews || []
  const avg = reviews.length > 0 ? (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1) : "—"

  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r: any) => r.rating === star).length,
    pct: reviews.length > 0 ? (reviews.filter((r: any) => r.rating === star).length / reviews.length * 100) : 0,
  }))

  return (
    <Box p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="orange" size={36} radius="md"><IconStar size={20} fill="currentColor" /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={22} c="dark.9" ff="var(--font-display),sans-serif">Отзывы</Text>
            <Text size="xs" c="gray.5">{reviews.length} отзывов</Text>
          </Stack>
        </Group>

        {isLoading ? (
          <Center py={80}><Loader size="sm" color="orange" /></Center>
        ) : reviews.length === 0 ? (
          <Paper radius="md" p="xl" withBorder>
            <Center>
              <Stack align="center" gap="sm">
                <ThemeIcon variant="light" color="gray" size={56} radius="md"><IconMessage2 size={28} /></ThemeIcon>
                <Text c="gray.5">Пока нет отзывов</Text>
              </Stack>
            </Center>
          </Paper>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            {/* Сводка рейтинга */}
            <Paper radius="md" p="lg" withBorder>
              <Stack gap="sm" align="center">
                <Text fw={800} fz={48} c="dark.9" lh={1}>{avg}</Text>
                <Rating value={Number(avg) || 0} readOnly size="lg" />
                <Text size="xs" c="gray.5">из {reviews.length} отзывов</Text>
              </Stack>
              <Divider my="sm" />
              <Stack gap={4}>
                {dist.map((d) => (
                  <Group key={d.star} gap="xs" align="center">
                    <Text fz="xs" c="gray.5" style={{ width: 20 }}>{d.star}★</Text>
                    <Box style={{ flex: 1, height: 6, background: "var(--mantine-color-gray-1)", borderRadius: 3, overflow: "hidden" }}>
                      <Box style={{ width: `${d.pct}%`, height: "100%", background: "#f59e0b", borderRadius: 3 }} />
                    </Box>
                    <Text fz="xs" c="gray.4" style={{ width: 30, textAlign: "right" }}>{d.count}</Text>
                  </Group>
                ))}
              </Stack>
            </Paper>

            {/* Список отзывов */}
            <Box style={{ gridColumn: "span 2" }}>
              <Stack gap="xs">
                {reviews.map((r: any) => (
                  <Paper key={r.id} radius="md" p="md" withBorder>
                    <Group gap="sm" align="flex-start" wrap="nowrap">
                      <Avatar src={r.user?.image} size={40} radius="xl" color="orange">{r.user?.name?.[0]?.toUpperCase()}</Avatar>
                      <Stack gap={4} style={{ flex: 1 }}>
                        <Group gap="sm" align="center" justify="space-between">
                          <Text fw={600} fz="sm" c="dark.9">{r.user?.name || "Аноним"}</Text>
                          <Text fz="xs" c="gray.4">{formatRelativeDate(r.createdAt)}</Text>
                        </Group>
                        <Rating value={r.rating} readOnly size="sm" />
                        {r.comment && <Text fz="sm" c="dark.7" mt={4}>{r.comment}</Text>}
                        {r.listing && (
                          <Link href={`/listings/vehicle/${r.listing.vehicleId || r.listing.id}`} style={{ textDecoration: "none" }}>
                            <Text fz="xs" c="indigo" mt={4}>→ {r.listing.title}</Text>
                          </Link>
                        )}
                      </Stack>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Box>
          </SimpleGrid>
        )}
      </Stack>
    </Box>
  )
}
