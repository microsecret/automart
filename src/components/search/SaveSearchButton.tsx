"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button, Modal, Stack, Text, TextInput, Switch } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { IconBell, IconBellPlus } from "@tabler/icons-react"
import { fetchJson, getApiClientErrorMessage } from "@/lib/api-client"

type Props = {
  /** Раздел: объявления площадки или импортные аукционы. */
  scope: "LISTINGS" | "AUCTIONS"
  /** Подсказка для названия — обычно то, что человек искал. */
  suggestedTitle?: string
}

/**
 * Подписка на текущий поиск.
 *
 * Машину редко покупают в первый визит: человек присматривается неделями.
 * Кнопка предлагает не возвращаться самому, а получить сообщение, когда
 * появится подходящий вариант.
 */
export default function SaveSearchButton({ scope, suggestedTitle }: Props) {
  const { data: session } = useSession()
  const params = useSearchParams()
  const [opened, setOpened] = useState(false)
  const [title, setTitle] = useState("")
  const [notify, setNotify] = useState(true)
  const [saving, setSaving] = useState(false)

  // Гостю подписываться некуда: уведомления уходят в Telegram, привязанный
  // к аккаунту.
  if (!session?.user) return null

  const query = params?.toString() || ""

  const openDialog = () => {
    setTitle(suggestedTitle?.trim() || defaultTitle(query, scope))
    setOpened(true)
  }

  const save = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      await fetchJson("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), scope, query, notifyTelegram: notify }),
      })
      notifications.show({
        title: "Подписка сохранена",
        message: notify
          ? "Бот сообщит, когда появятся новые подходящие варианты."
          : "Подписка сохранена без уведомлений — её можно открыть из кабинета.",
        color: "teal",
      })
      setOpened(false)
    } catch (error) {
      notifications.show({
        title: "Не удалось сохранить",
        message: getApiClientErrorMessage(error, "Попробуйте ещё раз позже."),
        color: "red",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        variant="light"
        color="indigo"
        size="compact-sm"
        leftSection={<IconBellPlus size={15} />}
        onClick={openDialog}
      >
        Следить за поиском
      </Button>

      <Modal opened={opened} onClose={() => setOpened(false)} title="Следить за поиском" radius="md" centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Сохраним ваши фильтры и сообщим, когда появятся новые подходящие варианты —
            не придётся возвращаться и проверять каталог вручную.
          </Text>

          <TextInput
            label="Название подписки"
            description="Чтобы отличать её от других в кабинете"
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            maxLength={120}
            data-autofocus
          />

          <Switch
            checked={notify}
            onChange={(event) => setNotify(event.currentTarget.checked)}
            label="Присылать уведомления в Telegram"
            description="Не чаще пяти сообщений в сутки"
          />

          <Button
            leftSection={<IconBell size={16} />}
            onClick={() => void save()}
            loading={saving}
            disabled={!title.trim()}
            fullWidth
          >
            {saving ? "Сохраняем" : "Сохранить подписку"}
          </Button>
        </Stack>
      </Modal>
    </>
  )
}

/**
 * Название по умолчанию из самих фильтров: пустое поле человек чаще всего
 * закрывает, а не заполняет.
 */
function defaultTitle(query: string, scope: Props["scope"]) {
  const params = new URLSearchParams(query)
  const parts = [params.get("make"), params.get("model")].filter(Boolean)
  if (parts.length > 0) return parts.join(" ")

  const search = params.get("q")?.trim()
  if (search) return search

  return scope === "AUCTIONS" ? "Аукционы: мой поиск" : "Объявления: мой поиск"
}
