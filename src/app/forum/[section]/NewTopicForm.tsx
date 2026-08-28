"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Button, Card, Collapse, Group, Select, Stack, Text, TextInput } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { IconBrandTelegram, IconPlus } from "@tabler/icons-react"
import { TOPIC_PREFIXES, TOPIC_TITLE_MAX, validatePostContent, validateTopicTitle } from "@/lib/forum"
import MarkupEditor from "@/components/forum/MarkupEditor"
import PollDraftFields, { EMPTY_POLL_DRAFT, type PollDraftState } from "@/components/forum/PollDraftFields"
import { validatePollDraft } from "@/lib/forum-poll"

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
  const [prefix, setPrefix] = useState<string | null>(null)
  const [poll, setPoll] = useState<PollDraftState>(EMPTY_POLL_DRAFT)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

  /* Признак читается после отрисовки: на сервере адреса нет, и проверка
     прямо в разметке дала бы мигание. */
  const [fromTelegram, setFromTelegram] = useState(false)
  useEffect(() => {
    setFromTelegram(new URLSearchParams(window.location.search).get("from") === "telegram")
  }, [])

  if (!session) {
    return (
      <Card withBorder radius="md" p="sm">
        <Stack gap="xs">
          <Text size="sm" c="var(--market-muted)">
            {fromTelegram
              ? "Чтобы задать вопрос, заведите аккаунт в боте — это три шага и пара минут."
              : "Войдите, чтобы задать вопрос или ответить"}
          </Text>
          <Group gap="xs" wrap="wrap">
            {/* Человек, пришедший из чата, входа по паролю не проходил: у
                него его просто нет, и форма пароля для него тупик. */}
            {fromTelegram && botUsername && (
              <Button
                component="a"
                href={`https://t.me/${botUsername}`}
                size="xs"
                radius="md"
                color="indigo"
                leftSection={<IconBrandTelegram size={14} />}
              >
                Открыть бот
              </Button>
            )}
            <Button
              component={Link}
              href={`/auth/signin?callbackUrl=${encodeURIComponent(`/forum/${sectionSlug}`)}`}
              size="xs"
              radius="md"
              variant={fromTelegram ? "subtle" : "filled"}
              color="indigo"
            >
              {fromTelegram ? "У меня уже есть аккаунт" : "Войти"}
            </Button>
          </Group>
        </Stack>
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

    /* Опрос проверяем здесь же, а не после публикации темы: иначе
       человек узнает об ошибке в опросе, когда тема уже создана и
       исправлять поздно. */
    if (poll.enabled) {
      const pollCheck = validatePollDraft({
        question: poll.question,
        options: poll.options,
        multiple: poll.multiple,
        closesInDays: poll.closesInDays ? Number(poll.closesInDays) : null,
      })
      if (!pollCheck.ok) {
        setError(pollCheck.error)
        return
      }
    }

    setSending(true)
    setError(null)
    try {
      const response = await fetch("/api/forum/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: sectionSlug, title: title.trim(), content: content.trim(), prefix }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Не удалось создать тему")

      /* Опрос создаётся вторым запросом, уже к готовой теме. Его неудача
         не отменяет публикации: тема написана и опубликована, а опрос
         автор добавит потом — терять текст из-за него было бы обидно. */
      if (poll.enabled) {
        const pollResponse = await fetch("/api/forum/polls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topicId: payload.topic.id,
            question: poll.question,
            options: poll.options,
            multiple: poll.multiple,
            closesInDays: poll.closesInDays ? Number(poll.closesInDays) : null,
          }),
        })
        if (!pollResponse.ok) {
          const pollPayload = await pollResponse.json().catch(() => null)
          notifications.show({
            title: "Тема создана, опрос — нет",
            message: pollPayload?.error || "Опрос не удалось добавить",
            color: "orange",
          })
        }
      }

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
            {/* Метка необязательна: тема без неё нормальна, а принуждение
                выбрать из списка заканчивается тем, что все жмут первый
                пункт. «Решено» в списке нет — её ставит отметка лучшего
                ответа, а не автор. */}
            <Select
              label="Метка"
              placeholder="без метки"
              data={TOPIC_PREFIXES.map((item) => ({ value: item.value, label: item.label }))}
              value={prefix}
              onChange={setPrefix}
              clearable
              size="sm"
              w={200}
              disabled={sending}
            />
            <MarkupEditor
              label="Подробности"
              placeholder="Опишите ситуацию: что за машина, что смущает, какой опыт уже есть"
              value={content}
              onChange={setContent}
              minRows={4}
              disabled={sending}
            />
            <PollDraftFields value={poll} onChange={setPoll} disabled={sending} />
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
