"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Button, Card, Group, Stack, Text } from "@mantine/core"
import { validatePostContent } from "@/lib/forum"
import MarkupEditor from "@/components/forum/MarkupEditor"

/** Ответ в теме. */
export default function ReplyForm({ topicId, returnPath }: { topicId: string; returnPath: string }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [content, setContent] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!session) {
    return (
      <Card withBorder radius="md" p="sm">
        <Group justify="space-between" gap="sm" wrap="wrap">
          <Text size="sm" c="var(--market-muted)">Войдите, чтобы ответить в теме</Text>
          <Button component={Link} href={`/auth/signin?callbackUrl=${encodeURIComponent(returnPath)}`} size="xs" radius="md" color="indigo">
            Войти
          </Button>
        </Group>
      </Card>
    )
  }

  const submit = async () => {
    /* Проверяем до отправки: ошибка от сервера после нажатия — ожидание
       впустую, а текст в поле всё равно останется. */
    const contentError = validatePostContent(content)
    if (contentError) {
      setError(contentError)
      return
    }

    setSending(true)
    setError(null)
    try {
      const response = await fetch("/api/forum/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, content: content.trim() }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Не удалось отправить ответ")

      setContent("")
      router.refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось отправить ответ")
    } finally {
      setSending(false)
    }
  }

  return (
    <Card withBorder radius="md" p="sm">
      <Stack gap="xs">
        <MarkupEditor
          label="Ваш ответ"
          placeholder="Поделитесь опытом — что сработало, а что нет"
          value={content}
          onChange={setContent}
          minRows={3}
          disabled={sending}
        />
        {error && <Text size="xs" c="red.6">{error}</Text>}
        <Group>
          <Button color="indigo" size="sm" radius="md" loading={sending} onClick={() => void submit()}>
            Ответить
          </Button>
        </Group>
      </Stack>
    </Card>
  )
}
