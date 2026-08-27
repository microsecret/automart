"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ActionIcon, Tooltip } from "@mantine/core"
import { IconBellOff } from "@tabler/icons-react"

/**
 * Отписка от темы в списке отслеживаемых.
 *
 * Здесь только снятие: в этом списке лежат темы, на которые человек уже
 * подписан, и переключатель показывал бы состояние, которое очевидно из
 * самого факта присутствия строки.
 */
export default function UnsubscribeButton({ topicId }: { topicId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [gone, setGone] = useState(false)

  const unsubscribe = async () => {
    if (busy) return
    setBusy(true)
    try {
      const response = await fetch("/api/forum/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId }),
      })
      if (!response.ok) throw new Error("отказ")
      /* Строка гаснет сразу, а список перечитывается следом: без этого
         тема остаётся на месте до обновления, и кажется, что нажатие не
         сработало. */
      setGone(true)
      router.refresh()
    } catch {
      setBusy(false)
    }
  }

  return (
    <Tooltip label="Перестать следить" withArrow>
      <ActionIcon
        variant="subtle"
        color="gray"
        onClick={() => void unsubscribe()}
        loading={busy && !gone}
        disabled={gone}
        aria-label="Перестать следить за темой"
      >
        <IconBellOff size={16} />
      </ActionIcon>
    </Tooltip>
  )
}
