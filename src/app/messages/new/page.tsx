"use client"
export const dynamic = "force-dynamic"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import useSWR from "swr"
import { useSession } from "next-auth/react"
import {
  Container,
  Stack,
  Text,
  Title,
  Center,
  Loader,
  TextInput,
  Card,
  Avatar,
  Group,
} from "@mantine/core"
import { IconSearch, IconMessageCirclePlus } from "@tabler/icons-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface User {
  id: string
  name: string | null
  email: string | null
  image: string | null
}

function NewMessageContent() {
  const { data: session, status } = useSession() || { data: null, status: 'unauthenticated' }
  const router = useRouter()
  const sp = useSearchParams()
  const listingId = sp.get("listingId")
  const [query, setQuery] = useState("")

  const { data, isLoading } = useSWR<{ users: User[] }>(
    session ? `/api/users${query ? `?q=${encodeURIComponent(query)}` : ""}` : null,
    fetcher
  )

  useEffect(() => {
    if (status === "loading") return
    if (!session) router.push("/auth/signin")
  }, [session, status, router])

  const startConversation = (userId: string) => {
    const ids = [session!.user.id, userId].sort()
    const conversationId = listingId
      ? `${ids[0]}-${ids[1]}-${listingId}`
      : `${ids[0]}-${ids[1]}`
    router.push(`/messages/${conversationId}`)
  }

  if (status === "loading" || !session) {
    return <Container py={80}><Center><Loader color="indigo" /></Center></Container>
  }

  return (
    <Container size="sm" py="lg">
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={1} size="h2">Новое сообщение</Title>
          <Text size="sm" c="#71717a">Выберите пользователя для начала диалога</Text>
        </Stack>

        <TextInput
          placeholder="Поиск по имени или email..."
          leftSection={<IconSearch size={16} />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          radius="md"
        />

        {isLoading ? (
          <Center py={40}><Loader color="indigo" /></Center>
        ) : (
          <Stack gap="xs" className="av-fade-in">
            {(data?.users || []).filter((u) => u.id !== session!.user.id).map((user) => (
              <Card
                key={user.id}
                withBorder
                radius="md"
                p="sm"
                style={{ cursor: "pointer", transition: "all 150ms ease" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#c7d2fe" }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e4e4e7" }}
                onClick={() => startConversation(user.id)}
              >
                <Group gap="sm">
                  <Avatar src={user.image} radius="xl" color="indigo">
                    {user.name?.[0]?.toUpperCase()}
                  </Avatar>
                  <Stack gap={2} style={{ flex: 1 }}>
                    <Text size="sm" fw={500}>{user.name || "Пользователь"}</Text>
                    <Text size="xs" c="#a1a1aa">{user.email}</Text>
                  </Stack>
                  <IconMessageCirclePlus size={20} color="#4f46e5" />
                </Group>
              </Card>
            ))}
            {data?.users?.length === 0 && (
              <Center py={40}>
                <Text size="sm" c="#a1a1aa">Пользователи не найдены</Text>
              </Center>
            )}
          </Stack>
        )}
      </Stack>
    </Container>
  )
}

export default function NewMessagePage() {
  return (
    <Suspense fallback={<Container py={80}><Center><Loader color="indigo" /></Center></Container>}>
      <NewMessageContent />
    </Suspense>
  )
}
