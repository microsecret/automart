"use client"
export const dynamic = "force-dynamic"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import {
  Container,
  Stack,
  Text,
  Title,
  Center,
  Loader,
  Card,
  Avatar,
  Group,
  Rating,
  Box,
  ThemeIcon,
} from "@mantine/core"
import { IconStarOff, IconStar } from "@tabler/icons-react"
import { formatRelativeDate, formatPriceShort } from "@/lib/format"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Review {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  listing?: { id: string; title: string; price: number | null } | null
  user?: { id: string; name: string | null; image: string | null } | null
}

export default function ReviewsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { data, isLoading } = useSWR<{ reviews: Review[] }>(
    session ? "/api/reviews" : null,
    fetcher
  )

  useEffect(() => {
    if (status === "loading") return
    if (!session) router.push("/auth/signin")
  }, [session, status, router])

  if (status === "loading" || !session) {
    return (
      <Container py={80}>
        <Center><Loader color="indigo" /></Center>
      </Container>
    )
  }

  const reviews = data?.reviews || []
  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0

  return (
    <Container size="md" py="lg">
      <Stack gap="lg">
        <Stack gap={2}>
          <Title order={1} size="h2">Мои отзывы</Title>
          <Group gap={8} align="center">
            {reviews.length > 0 ? (
              <>
                <Rating value={avgRating} readOnly size="sm" />
                <Text size="sm" c="#71717a">{avgRating.toFixed(1)} · {reviews.length} отзывов</Text>
              </>
            ) : (
              <Text size="sm" c="#71717a">0 отзывов</Text>
            )}
          </Group>
        </Stack>

        {isLoading ? (
          <Center py={60}><Loader color="indigo" /></Center>
        ) : reviews.length === 0 ? (
          <Center py={80}>
            <Stack align="center" gap="md">
              <IconStarOff size={48} color="#d4d4d8" />
              <Stack gap={4} align="center">
                <Text fw={500} c="#52525b">Вы ещё не оставляли отзывов</Text>
                <Text size="sm" c="#a1a1aa">Оставьте первый отзыв на странице объявления</Text>
              </Stack>
            </Stack>
          </Center>
        ) : (
          <Stack gap="sm" className="av-fade-in">
            {reviews.map((review) => (
              <Card key={review.id} withBorder radius="md" p="md">
                <Stack gap="xs">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={4}>
                      {review.listing && (
                        <Text size="sm" fw={600} c="#18181b">{review.listing.title}</Text>
                      )}
                      <Rating value={review.rating} readOnly size="xs" />
                    </Stack>
                    <Text size="xs" c="#a1a1aa">{formatRelativeDate(review.createdAt)}</Text>
                  </Group>
                  {review.comment && (
                    <Text size="sm" c="#52525b" lh={1.5}>{review.comment}</Text>
                  )}
                </Stack>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  )
}
