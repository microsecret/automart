"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Center, Container, Loader, Stack, Text, Title } from "@mantine/core"
import ListingModerationPanel from "@/components/moderation/ListingModerationPanel"

function canModerate(role?: string | null) {
  return role === "ADMIN" || role === "MODERATOR"
}

/** Dedicated, least-privilege workspace for listing review. */
export default function ModerationPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const allowed = canModerate(session?.user?.role)

  useEffect(() => {
    if (status === "loading") return
    if (!session) router.replace("/auth/signin?callbackUrl=/moderation")
    else if (!allowed) router.replace("/")
  }, [allowed, router, session, status])

  if (status === "loading") return <Center h={400}><Loader color="indigo" /></Center>
  if (!session || !allowed) return <Center h={400}><Text c="dimmed">Проверяем права доступа…</Text></Center>

  return (
    <Container size="xl" py={{ base: "sm", md: "lg" }}>
      <Stack gap="md">
        <Stack gap={2}>
          <Title order={1} size="h2" ff="var(--font-display),sans-serif">Модерация объявлений</Title>
          <Text size="sm" c="dimmed">Проверяйте публикации, оставляйте понятную причину отклонения и ведите решения в журнале.</Text>
        </Stack>
        <ListingModerationPanel />
      </Stack>
    </Container>
  )
}
