"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Button, Card, Collapse, Group, Stack, Text, Textarea, TextInput } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { IconPlus } from "@tabler/icons-react"
import { TOPIC_TITLE_MAX, validatePostContent, validateTopicTitle } from "@/lib/forum"

/**
 * Создание темы прямо в разделе.
 *
 * Отдельная страница «новая тема» добавляла бы переход и потерю контекста:
 * человек уже видит, о чём здесь говорят, и пишет не отходя.
 */
export default function NewTopicForm({ sectionSlug }: { sectionSlug: string }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [opened, setOpened] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!session) {
    return (
      <Card withBorder radius="md" p="sm">
        <Group justify="space-between" gap="sm" wrap="wrap">
          <Text size="sm" c="var(--market-muted)">Войдите, чтобы задать вопрос или ответить</Text>
          <Button
            component={Link}
            href={`/auth/signin?callbackUrl=${encodeURIComponent(`/forum/${sectionSlug}`)}`}
            size="xs"
            radius="md"
            color="indigo"
          >
            Войти
          </Button>
        </Group>
      </Card>
    )
  }

  const submit = async () => {
    /* Проверяем до отправки: ошибка от сервера после нажатия — это
       ожидание впустую, а текст в поле всё равно останется. */
    const titleError = validateTopicTitle(title)
    const contentError = validatePostContent(content)
    if (titleError || contentError) {
      setError(titleError || contentError)
      return
    }

    setSending(true)
    setError(null)
    try {
      const response = await fetch("/api/forum/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: sectionSlug, title: title.trim(), content: content.trim() }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Не удалось создать тему")

      notifications.show({ title: "Тема создана", message: "Ваш вопрос опубликован", color: "indigo" })
      router.push(`/forum/${sectionSlug}/${payload.topic.slug}`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось создать тему")
    } finally {
      setSending(false)
    }
  }

  return (
    <Card withBorder radius="md" p="sm">
      {!opened ? (
        <Button
          variant="light"
          color="indigo"
          size="sm"
          radius="md"
          leftSection={<IconPlus size={16} />}
          onClick={() => setOpened(true)}
        >
          Задать вопрос в разделе
        </Button>
      ) : (
        <Collapse in={opened}>
          <Stack gap="xs">
            <TextInput
              label="О чём вопрос"
              placeholder="Например: Стоит ли брать Haval Jolion в 2026 году"
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
              maxLength={TOPIC_TITLE_MAX}
              size="sm"
            />
            <Textarea
              label="Подробности"
              placeholder="Опишите ситуацию: что за машина, что смущает, какой опыт уже есть"
              value={content}
              onChange={(event) => setContent(event.currentTarget.value)}
              minRows={4}
              autosize
              size="sm"
            />
            {error && <Text size="xs" c="red.6">{error}</Text>}
            <Group gap="xs">
              <Button color="indigo" size="sm" radius="md" loading={sending} onClick={() => void submit()}>
                Опубликовать
              </Button>
              <Button variant="subtle" color="gray" size="sm" onClick={() => setOpened(false)} disabled={sending}>
                Отмена
              </Button>
            </Group>
          </Stack>
        </Collapse>
      )}
    </Card>
  )
}
