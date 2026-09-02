"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Group, Modal, Paper, Stack, Text, Textarea, ThemeIcon } from "@mantine/core"
import { IconShieldCog, IconEyeOff, IconTrash, IconUserOff } from "@tabler/icons-react"
import { LISTING_STATUS } from "@/lib/listing-lifecycle"
import { getApiClientErrorMessage } from "@/lib/api-client"

type Action = "pause" | "delete" | "ban"

const ACTION_COPY: Readonly<Record<Action, { title: string; confirm: string; hint: string; needsReason: boolean }>> = {
  pause: {
    title: "Снять с публикации",
    confirm: "Снять объявление",
    hint: "Объявление исчезнет из каталога. Владелец увидит причину и сможет исправить карточку.",
    needsReason: true,
  },
  delete: {
    title: "Удалить объявление",
    confirm: "Удалить",
    hint: "Карточка уходит в архив и перестаёт открываться по ссылке. Действие видно в журнале модерации.",
    needsReason: false,
  },
  ban: {
    title: "Заблокировать продавца",
    confirm: "Заблокировать",
    hint: "Продавец потеряет доступ к площадке, а его объявления перестанут показываться.",
    needsReason: true,
  },
}

/**
 * Действия модератора прямо на карточке объявления.
 *
 * Раньше модератор видел нарушение на странице, но уходил разбираться в
 * админ-панель и там искал ту же карточку заново. Решение принимается там же,
 * где видно проблему.
 */
export default function ListingModerationActions({
  listingId,
  sellerId,
  sellerName,
}: {
  listingId: string
  sellerId: string
  sellerName: string | null
}) {
  const router = useRouter()
  const [action, setAction] = useState<Action | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    if (busy) return
    setAction(null)
    setReason("")
    setError(null)
  }

  const submit = async () => {
    if (!action) return
    const copy = ACTION_COPY[action]
    // Причина обязательна там, где решение задевает человека: продавец должен
    // понимать, что исправить.
    if (copy.needsReason && reason.trim().length < 3) {
      setError("Укажите причину — её увидит продавец")
      return
    }
    setBusy(true)
    setError(null)
    try {
      let response: Response
      if (action === "pause") {
        response = await fetch("/api/admin/listings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          // PAUSED, а не REJECTED: объявление снимается с витрины, но владелец
          // может вернуть его сам, исправив причину.
          body: JSON.stringify({ id: listingId, status: LISTING_STATUS.PAUSED, reason: reason.trim() }),
        })
      } else if (action === "delete") {
        response = await fetch("/api/admin/listings", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: listingId }),
        })
      } else {
        response = await fetch(`/api/admin/users/${sellerId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accountStatus: "BANNED", restrictionReason: reason.trim() }),
        })
      }

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setError(typeof payload?.error === "string" ? payload.error : "Не удалось выполнить действие")
        setBusy(false)
        return
      }

      close()
      router.refresh()
    } catch (requestError) {
      setError(getApiClientErrorMessage(requestError, "Нет связи с сервером. Попробуйте ещё раз."))
    } finally {
      setBusy(false)
    }
  }

  const copy = action ? ACTION_COPY[action] : null

  return (
    <>
      <Paper withBorder radius="md" p="md">
        <Group gap="xs" mb="sm">
          <ThemeIcon variant="light" color="grape" size={30} radius="md"><IconShieldCog size={16} /></ThemeIcon>
          <Text size="sm" fw={700}>Модерация</Text>
        </Group>
        <Stack gap="xs">
          <Button
            variant="light"
            color="orange"
            leftSection={<IconEyeOff size={16} />}
            onClick={() => setAction("pause")}
            fullWidth
          >
            Снять с публикации
          </Button>
          <Button
            variant="light"
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={() => setAction("delete")}
            fullWidth
          >
            Удалить объявление
          </Button>
          <Button
            variant="light"
            color="dark"
            leftSection={<IconUserOff size={16} />}
            onClick={() => setAction("ban")}
            fullWidth
          >
            Заблокировать продавца
          </Button>
        </Stack>
      </Paper>

      <Modal opened={Boolean(action)} onClose={close} title={copy?.title} radius="lg" centered>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">{copy?.hint}</Text>
          {action === "ban" && (
            <Text size="sm">
              Продавец: <Text span fw={700}>{sellerName || "без имени"}</Text>
            </Text>
          )}
          {copy?.needsReason && (
            <Textarea
              label="Причина"
              placeholder="Например: фотографии не соответствуют автомобилю"
              autosize
              minRows={2}
              value={reason}
              onChange={(event) => setReason(event.currentTarget.value)}
            />
          )}
          {error && <Text size="sm" c="var(--market-danger-text)">{error}</Text>}
          <Group justify="flex-end" gap="xs">
            {/* Кнопка была subtle — без фона она читалась только при наведении,
                и выход из окна выглядел недоступным. */}
            <Button variant="default" onClick={close} disabled={busy}>Отмена</Button>
            <Button
              color={action === "pause" ? "orange" : "red"}
              onClick={submit}
              loading={busy}
            >
              {copy?.confirm}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
