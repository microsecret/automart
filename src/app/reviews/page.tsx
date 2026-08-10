"use client"
export const dynamic = "force-dynamic"
import { useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { Box, Stack, Group, Text, Paper, Center, Loader, ThemeIcon, Avatar, SimpleGrid, Rating, Divider, Pagination } from "@mantine/core"
import { IconStar, IconMessage2 } from "@tabler/icons-react"
import { formatRelativeDate } from "@/lib/format"
import { AsyncErrorState } from "@/components/ui/AsyncStates"

type ReviewListing = {
  id: string
  title: string
  price: number
  vehicleId: string | null
  partId: string | null
}

type MarketplaceReview = {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  user: { id: string; name: string | null; image: string | null }
  listing: ReviewListing | null
}

type ReviewsResponse = {
  reviews: MarketplaceReview[]
  summary: {
    averageRating: number | null
    total: number
    distribution: Array<{ rating: number; count: number }>
  }
  pagination: { page: number; limit: number; total: number; pages: number }
}

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Не удалось загрузить отзывы"
    throw new Error(message)
  }
  return payload as T
}

function getListingHref(listing: ReviewListing) {
  if (listing.vehicleId) return `/listings/vehicle/${listing.vehicleId}`
  if (listing.partId) return `/listings/part/${listing.partId}`
  return "/"
}

export default function ReviewsPage() {
  const [page, setPage] = useState(1)
  const { data, error, isLoading, mutate } = useSWR<ReviewsResponse>(`/api/reviews?limit=15&page=${page}`, fetcher)

  const reviews = data?.reviews || []
  const summary = data?.summary
  const reviewCount = summary?.total || 0
  const avg = summary?.averageRating ? summary.averageRating.toFixed(1) : "—"

  const dist = [5, 4, 3, 2, 1].map((star) => {
    const count = summary?.distribution.find((item) => item.rating === star)?.count || 0
    return {
    star,
    count,
    pct: reviewCount > 0 ? (count / reviewCount * 100) : 0,
  }})

  return (
    <Box p={{ base: "sm", md: "md" }}>
      <Stack gap="md">
        <Group gap="sm" align="center">
          <ThemeIcon variant="light" color="orange" size={36} radius="md"><IconStar size={20} fill="currentColor" /></ThemeIcon>
          <Stack gap={0}>
            <Text component="h1" fw={800} fz={22} c="dark.9" ff="var(--font-display),sans-serif">Отзывы</Text>
            <Text size="xs" c="gray.5">{reviewCount} отзывов</Text>
          </Stack>
        </Group>

        {error ? (
          <AsyncErrorState title="Не удалось загрузить отзывы" description="Отзывы временно недоступны. Повторите попытку — это не означает, что их нет." onRetry={() => void mutate()} />
        ) : isLoading ? (
          <Center py={80}><Loader size="sm" color="orange" /></Center>
        ) : reviewCount === 0 ? (
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
                <Text size="xs" c="gray.5">из {reviewCount} отзывов</Text>
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
                {reviews.map((review) => (
                  <Paper key={review.id} radius="md" p="md" withBorder>
                    <Group gap="sm" align="flex-start" wrap="nowrap">
                      <Avatar src={review.user.image} size={40} radius="xl" color="orange">{review.user.name?.[0]?.toUpperCase()}</Avatar>
                      <Stack gap={4} style={{ flex: 1 }}>
                        <Group gap="sm" align="center" justify="space-between">
                          <Text fw={600} fz="sm" c="dark.9">{review.user.name || "Аноним"}</Text>
                          <Text fz="xs" c="gray.4">{formatRelativeDate(review.createdAt)}</Text>
                        </Group>
                        <Rating value={review.rating} readOnly size="sm" />
                        {review.comment && <Text fz="sm" c="dark.7" mt={4}>{review.comment}</Text>}
                        {review.listing && (
                          <Link href={getListingHref(review.listing)} style={{ textDecoration: "none" }}>
                            <Text fz="xs" c="indigo" mt={4}>→ {review.listing.title}</Text>
                          </Link>
                        )}
                      </Stack>
                    </Group>
                  </Paper>
                ))}
              </Stack>
              {(data?.pagination.pages || 0) > 1 && (
                <Center mt="lg">
                  <Pagination total={data?.pagination.pages || 1} value={page} onChange={setPage} boundaries={1} siblings={1} radius="md" />
                </Center>
              )}
            </Box>
          </SimpleGrid>
        )}
      </Stack>
    </Box>
  )
}
