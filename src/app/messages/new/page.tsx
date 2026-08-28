"use client"

import { Suspense, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button, Center, Container, Loader, Paper, Stack, Text, ThemeIcon, Title } from "@mantine/core"
import { IconArrowRight, IconShieldCheck } from "@tabler/icons-react"
import { createConversationId } from "@/lib/messages"

export const dynamic = "force-dynamic"

function NewMessageContent() {
  const { data: session, status } = useSession() || { data: null, status: "unauthenticated" }
  const router = useRouter()
  const searchParams = useSearchParams()
  const listingId = searchParams.get("listingId")
  const recipientId = searchParams.get("recipientId")

  useEffect(() => {
    if (status !== "loading" && !session) {
      /* Возврат после входа обязателен: человек нажал «Написать
         продавцу», и без callbackUrl он оказывался на главной — намерение
         и объявление терялись на самом дорогом шаге воронки. */
      const here = `${window.location.pathname}${window.location.search}`

      /* Признак «из чата» переносится на форму входа: человек, пришедший
         из Telegram, пароля не заводил, и форма пароля для него тупик.
         Без переноса он терялся здесь, на последнем шаге перед входом. */
      const fromTelegram = searchParams.get("from") === "telegram"
      const signIn = `/auth/signin?callbackUrl=${encodeURIComponent(here)}${fromTelegram ? "&from=telegram" : ""}`
      router.replace(signIn)
    }
  }, [router, searchParams, session, status])

  useEffect(() => {
    if (!session || !recipientId) return

    const conversationId = createConversationId(session.user.id, recipientId, listingId)
    const params = new URLSearchParams({ recipientId })
    if (listingId) params.set("listingId", listingId)
    router.replace(`/messages/${conversationId}?${params.toString()}`)
  }, [listingId, recipientId, router, session])

  if (status === "loading" || !session || recipientId) {
    return <Container py={80}><Center><Loader color="indigo" /></Center></Container>
  }

  return (
    <Container size="sm" py={{ base: 42, sm: 72 }}>
      <Paper withBorder radius="xl" p={{ base: "xl", sm: 44 }} className="av-fade-in" style={{ textAlign: "center" }}>
        <Stack align="center" gap="md">
          <ThemeIcon size={58} radius="xl" variant="light" color="indigo">
            <IconShieldCheck size={29} />
          </ThemeIcon>
          <Stack gap={4}>
            <Title order={1} fz={{ base: 26, sm: 32 }}>Безопасный диалог начинается с объявления</Title>
            <Text c="dimmed" maw={470}>
              Так покупатель сразу видит предмет обсуждения, а продавец получает защищённую переписку по своему объявлению.
            </Text>
          </Stack>
          <Button component={Link} href="/" size="md" radius="md" rightSection={<IconArrowRight size={17} />}>
            Открыть объявления
          </Button>
        </Stack>
      </Paper>
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
