"use client"

import { useState } from "react"
import { Button, Group, Modal, Radio, Stack, Text, Textarea } from "@mantine/core"
import { REPORT_COMMENT_MAX, REPORT_REASONS, validateReport } from "@/lib/forum-reports"

/**
 * Жалоба на сообщение.
 *
 * Без неё спам убирать некому: модератор не читает каждую тему, а
 * участник, наткнувшийся на рекламу, уходит и больше не возвращается.
 */

type Props = {
  postId: string
  opened: boolean
  onClose: () => void
}

export default function ReportDialog({ postId, opened, onClose }: Props) {
  const [reason, setReason] = useState<string>("")
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const close = () => {
    onClose()
    /* Состояние сбрасывается при закрытии, а не при открытии: иначе
       повторное открытие после отправки покажет старую благодарность. */
    setTimeout(() => {
      setReason("")
      setComment("")
      setError(null)
      setSent(false)
    }, 200)
  }

  const send = async () => {
    /* Проверяем до отправки: ошибка от сервера после нажатия — ожидание
       впустую, а выбранное всё равно останется в форме. */
    const check = validateReport({ reason, comment })
    if (!check.ok) {
      setError(check.error)
      return
    }

    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/forum/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, reason, comment }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Не удалось отправить жалобу")
      setSent(true)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Не удалось отправить жалобу")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal opened={opened} onClose={close} title="Пожаловаться на сообщение" size="md" radius="md">
      {sent ? (
        <Stack gap="sm">
          <Text size="sm">
            Жалоба отправлена. Модератор посмотрит сообщение — отвечать на жалобу мы не будем,
            но разберёмся.
          </Text>
          <Group justify="flex-end">
            <Button size="sm" onClick={close}>Понятно</Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="sm">
          <Radio.Group value={reason} onChange={(value) => { setReason(value); setError(null) }} label="Что не так">
            <Stack gap={6} mt={6}>
              {REPORT_REASONS.map((item) => (
                <Radio key={item.value} value={item.value} label={item.label} size="sm" />
              ))}
            </Stack>
          </Radio.Group>

          {/* Пояснение обязательно для «Другое» и «Опасный совет»: без него
              модератор не отличит неверную рекомендацию от несогласия с
              ней, а на форуме о технике это разные вещи. */}
          <Textarea
            label="Пояснение"
            description={reason === "OTHER" || reason === "WRONG" ? "Обязательно для этой причины" : "Необязательно"}
            placeholder="Коротко, что не так"
            value={comment}
            onChange={(event) => setComment(event.currentTarget.value)}
            maxLength={REPORT_COMMENT_MAX}
            minRows={2}
            autosize
            size="sm"
            disabled={busy}
          />

          {error && <Text size="xs" c="red.6" role="alert">{error}</Text>}

          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" color="gray" size="sm" onClick={close} disabled={busy}>Отмена</Button>
            <Button color="red" size="sm" loading={busy} onClick={() => void send()} disabled={!reason}>
              Отправить
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
