"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Button, Card, Group, Stack, Text } from "@mantine/core"
import { IconBrandTelegram } from "@tabler/icons-react"
import { validatePostContent } from "@/lib/forum"
import MarkupEditor from "@/components/forum/MarkupEditor"
import { QUOTE_EVENT, buildQuote, type QuoteRequest } from "@/lib/forum-quote"

/** Ответ в теме. */
export default function ReplyForm({ topicId, returnPath }: { topicId: string; returnPath: string }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [content, setContent] = useState("")
  const [sending, setSending] = useState(false)
  /* Черновик ответа переживает уход со страницы.

     Редактор рассчитан на длинные тексты — списки, таблицы, вставку
     картинок, — то есть площадка сама поощряет писать помногу. Но
     написанное жило только в памяти вкладки: на телефоне переключение
     на другое приложение регулярно выгружает страницу, и человек
     возвращался к пустому полю.

     sessionStorage, а не localStorage: черновик нужен на время этого
     захода, а не навсегда. Ключ с номером темы — в разных темах
     ответы разные. */
  const draftKey = `forum-reply-draft:${topicId}`
  const draftRestoredRef = useRef(false)

  useEffect(() => {
    if (draftRestoredRef.current) return
    draftRestoredRef.current = true
    try {
      const saved = window.sessionStorage.getItem(draftKey)
      if (saved) setContent(saved)
    } catch {
      /* Приватное окно или запрет на хранилище — не повод падать. */
    }
  }, [draftKey])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (content.trim()) window.sessionStorage.setItem(draftKey, content)
        else window.sessionStorage.removeItem(draftKey)
      } catch {
        /* Переполненное хранилище не должно ломать ответ. */
      }
    }, 600)
    return () => window.clearTimeout(timer)
  }, [content, draftKey])
  const [error, setError] = useState<string | null>(null)
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

  /* Человек, пришедший из чата, входа по паролю не проходил: у него его
     просто нет. Отправлять его на форму пароля — тупик, из которого он
     уходит. Бот заводит учётную запись тремя шагами и возвращает сюда.

     Признак читается после отрисовки: на сервере адреса нет, и проверка
     прямо в разметке дала бы мигание — сначала общий текст, потом
     нужный. */
  const [fromTelegram, setFromTelegram] = useState(false)
  useEffect(() => {
    setFromTelegram(new URLSearchParams(window.location.search).get("from") === "telegram")
  }, [])
  const cardRef = useRef<HTMLDivElement>(null)

  /* Цитата приходит событием от кнопки под сообщением: она в другой
     части дерева, и общего родителя у них нет. Подробности — в
     src/lib/forum-quote.ts. */
  useEffect(() => {
    const onQuote = (event: Event) => {
      const request = (event as CustomEvent<QuoteRequest>).detail
      if (!request) return

      /* Цитата добавляется к написанному, а не заменяет его: человек мог
         уже набрать половину ответа, прежде чем решил процитировать. */
      setContent((current) => {
        const prefix = current.trim() ? `${current.replace(/\s+$/, "")}\n\n` : ""
        return prefix + buildQuote(request)
      })

      /* Поле внизу страницы: без прокрутки нажатие «Цитировать» выглядит
         так, будто ничего не произошло. */
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    }

    window.addEventListener(QUOTE_EVENT, onQuote)
    return () => window.removeEventListener(QUOTE_EVENT, onQuote)
  }, [])

  if (!session) {
    return (
      <Card withBorder radius="md" p="sm">
        <Stack gap="xs">
          <Text size="sm" c="var(--market-muted)">
            {fromTelegram
              ? "Чтобы ответить, заведите аккаунт в боте — это три шага и пара минут."
              : "Войдите, чтобы ответить в теме"}
          </Text>
          <Group gap="xs" wrap="wrap">
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
              href={`/auth/signin?callbackUrl=${encodeURIComponent(returnPath)}`}
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
      /* Ответ отправлен — черновик больше не нужен. */
      try {
        window.sessionStorage.removeItem(draftKey)
      } catch {
        /* Хранилище закрыто: черновик просто останется до конца сеанса. */
      }
      router.refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось отправить ответ")
    } finally {
      setSending(false)
    }
  }

  return (
    <Card withBorder radius="md" p="sm" ref={cardRef}>
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
