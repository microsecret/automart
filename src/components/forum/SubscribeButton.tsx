"use client"

import { useState } from "react"
import { Button, Tooltip } from "@mantine/core"
import { IconBell, IconBellOff } from "@tabler/icons-react"

/**
 * Подписка на тему.
 *
 * Человек спросил и ушёл: без уведомления он не узнает, что ответили, и
 * вернётся разве что случайно.
 *
 * Автор темы подписан на неё с самого создания, поэтому кнопка нужна
 * остальным: тем, кто читает чужой разбор и хочет узнать, чем кончилось.
 */
export default function SubscribeButton({
  topicId,
  initialSubscribed,
}: {
  topicId: string
  initialSubscribed: boolean
}) {
  const [subscribed, setSubscribed] = useState(initialSubscribed)
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    if (busy) return
    setBusy(true)

    /* Состояние меняется сразу: нажатие с задержкой в полсекунды
       читается как поломка. При отказе возвращается назад. */
    const previous = subscribed
    setSubscribed(!previous)

    try {
      const response = await fetch("/api/forum/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId }),
      })
      if (!response.ok) throw new Error("отказ")
    } catch {
      setSubscribed(previous)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Tooltip
      label={subscribed ? "Уведомления о новых ответах включены" : "Сообщать о новых ответах"}
      withArrow
    >
      <Button
        variant={subscribed ? "light" : "subtle"}
        color={subscribed ? "indigo" : "gray"}
        size="compact-sm"
        leftSection={subscribed ? <IconBell size={14} /> : <IconBellOff size={14} />}
        onClick={() => void toggle()}
        loading={busy}
        aria-pressed={subscribed}
      >
        {subscribed ? "Отслеживаю" : "Отслеживать"}
      </Button>
    </Tooltip>
  )
}
