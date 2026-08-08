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
  Button,
  Group,
} from "@mantine/core"
import { IconHeartOff } from "@tabler/icons-react"
import Link from "next/link"
import ListingRow, { ListingRowData } from "@/components/listings/ListingRow"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function FavoritesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { data, isLoading } = useSWR<{ favorites: ListingRowData[] }>(
    session ? "/api/favorites" : null,
    fetcher
  )

  useEffect(() => {
    if (status === "loading") return
    if (!session) router.push("/auth/signin")
  }, [session, status, router])

  if (status === "loading" || !session) {
    return (
      <Container py={80}>
        <Center>
          <Loader color="indigo" />
        </Center>
      </Container>
    )
  }

  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        <Group justify="space-between">
          <Stack gap={2}>
            <Title order={1} size="h2">Избранное</Title>
            <Text size="sm" c="#71717a">
              {data?.favorites?.length || 0} сохранённых объявлений
            </Text>
          </Stack>
        </Group>

        {isLoading ? (
          <Center py={60}>
            <Loader color="indigo" />
          </Center>
        ) : !data?.favorites?.length ? (
          <Center py={80}>
            <Stack align="center" gap="md">
              <IconHeartOff size={48} color="#d4d4d8" />
              <Stack gap={4} align="center">
                <Text fw={500} c="#52525b">В избранном пусто</Text>
                <Text size="sm" c="#a1a1aa">
                  Добавляйте объявления в избранное кнопкой-сердечком
                </Text>
              </Stack>
              <Button component={Link} href="/" variant="light" color="indigo">
                К объявлениям
              </Button>
            </Stack>
          </Center>
        ) : (
          <Stack gap="sm" className="av-fade-in">
            {data.favorites.map((listing) => (
              <ListingRow key={listing.id} listing={listing} />
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  )
}
